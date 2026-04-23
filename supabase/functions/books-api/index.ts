import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

async function sha256hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/functions\/v1\/books-api/, '')

  // ── Health check ──────────────────────────────────────────────
  if (req.method === 'GET' && path === '/ping') {
    const apiKey = await resolveApiKey(req)
    if (!apiKey) return json({ error: 'Invalid or missing API key' }, 401)
    return json({ ok: true, accountant_id: apiKey.accountant_id })
  }

  // ── Create journal entry ───────────────────────────────────────
  if (req.method === 'POST' && path === '/entries') {
    const apiKey = await resolveApiKey(req)
    if (!apiKey) return json({ error: 'Invalid or missing API key' }, 401)
    if (!apiKey.is_active) return json({ error: 'API key revoked' }, 403)
    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      return json({ error: 'API key expired' }, 403)
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400)
    }

    const parsed = parseEntryBody(body)
    if ('error' in parsed) return json({ error: parsed.error }, 400)

    // Validate balance: sum of debits must equal sum of credits
    const debitTotal = parsed.lines.filter(l => l.side === 'debit').reduce((s, l) => s + l.amount, 0)
    const creditTotal = parsed.lines.filter(l => l.side === 'credit').reduce((s, l) => s + l.amount, 0)
    if (Math.abs(debitTotal - creditTotal) > 0.005) {
      return json({ error: `Unbalanced entry: debits=${debitTotal} credits=${creditTotal}` }, 422)
    }

    // Use service role to bypass RLS for account code resolution + insert
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Resolve account codes → IDs
    const codes = [...new Set(parsed.lines.map(l => l.account_code))]
    const planQuery = supabase
      .from('account_plans')
      .select('id, code')
      .in('code', codes)
      .eq('is_analytic', true)

    const companyFilter = apiKey.ext_company_id
      ? planQuery.eq('ext_company_id', apiKey.ext_company_id)
      : planQuery.eq('company_id', apiKey.company_id)

    const { data: planRows, error: planErr } = await companyFilter
    if (planErr) return json({ error: 'Failed to resolve accounts' }, 500)

    const codeToId = new Map((planRows ?? []).map((r: { id: string; code: string }) => [r.code, r.id]))
    const missingCodes = codes.filter(c => !codeToId.has(c))
    if (missingCodes.length > 0) {
      return json({ error: `Unknown account codes: ${missingCodes.join(', ')}` }, 422)
    }

    // Insert journal entry
    const { data: entry, error: entryErr } = await supabase
      .from('journal_entries')
      .insert({
        ...(apiKey.ext_company_id
          ? { ext_company_id: apiKey.ext_company_id }
          : { company_id: apiKey.company_id }),
        accountant_id: apiKey.accountant_id,
        entry_date: parsed.entry_date,
        description: parsed.description,
        external_ref: parsed.external_ref ?? null,
        source: 'api',
      })
      .select('id')
      .single()

    if (entryErr) return json({ error: 'Failed to create entry' }, 500)

    // Insert lines
    const lines = parsed.lines.map(l => ({
      entry_id: entry.id,
      account_plan_id: codeToId.get(l.account_code)!,
      side: l.side,
      amount: l.amount,
      memo: l.memo ?? null,
    }))

    const { error: linesErr } = await supabase.from('journal_entry_lines').insert(lines)
    if (linesErr) {
      // Rollback the entry on line insert failure
      await supabase.from('journal_entries').delete().eq('id', entry.id)
      return json({ error: 'Failed to create entry lines' }, 500)
    }

    // Update last_used_at on the API key
    await supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', apiKey.id)

    return json({ id: entry.id }, 201)
  }

  return json({ error: 'Not found' }, 404)
})

// ── Helpers ────────────────────────────────────────────────────

interface ApiKeyRow {
  id: string
  accountant_id: string
  company_id: string | null
  ext_company_id: string | null
  is_active: boolean
  expires_at: string | null
}

async function resolveApiKey(req: Request): Promise<ApiKeyRow | null> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const rawKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  if (!rawKey) return null

  const hash = await sha256hex(rawKey)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data } = await supabase
    .from('api_keys')
    .select('id, accountant_id, company_id, ext_company_id, is_active, expires_at')
    .eq('key_hash', hash)
    .single()

  return data as ApiKeyRow | null
}

interface EntryLine {
  account_code: string
  side: 'debit' | 'credit'
  amount: number
  memo?: string
}

interface EntryBody {
  entry_date: string
  description: string
  external_ref?: string
  lines: EntryLine[]
}

function parseEntryBody(body: unknown): EntryBody | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Body must be an object' }
  const b = body as Record<string, unknown>

  if (typeof b.entry_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.entry_date)) {
    return { error: 'entry_date must be a string in YYYY-MM-DD format' }
  }
  if (typeof b.description !== 'string' || b.description.trim() === '') {
    return { error: 'description is required' }
  }
  if (!Array.isArray(b.lines) || b.lines.length < 2) {
    return { error: 'lines must be an array with at least 2 items' }
  }

  const lines: EntryLine[] = []
  for (const [i, line] of (b.lines as unknown[]).entries()) {
    if (typeof line !== 'object' || line === null) return { error: `lines[${i}] must be an object` }
    const l = line as Record<string, unknown>
    if (typeof l.account_code !== 'string') return { error: `lines[${i}].account_code must be a string` }
    if (l.side !== 'debit' && l.side !== 'credit') return { error: `lines[${i}].side must be 'debit' or 'credit'` }
    if (typeof l.amount !== 'number' || l.amount <= 0) return { error: `lines[${i}].amount must be a positive number` }
    lines.push({ account_code: l.account_code, side: l.side, amount: l.amount, memo: typeof l.memo === 'string' ? l.memo : undefined })
  }

  return {
    entry_date: b.entry_date,
    description: (b.description as string).trim(),
    external_ref: typeof b.external_ref === 'string' ? b.external_ref : undefined,
    lines,
  }
}
