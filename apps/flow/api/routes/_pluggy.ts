import { Hono } from 'hono'
import { createServiceClient, ensureCompanyMember, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

const PLUGGY_API = 'https://api.pluggy.ai'

// Cache do apiKey em memória — token tem validade ~2h, renovamos com 5min de margem
let _cachedApiKey: string | null = null
let _cachedApiKeyExpiresAt = 0

async function getPluggyApiKey(): Promise<string> {
  if (_cachedApiKey && Date.now() < _cachedApiKeyExpiresAt) return _cachedApiKey

  const clientId     = process.env.PLUGGY_CLIENT_ID
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('pluggy_not_configured')

  const res = await fetch(`${PLUGGY_API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  })
  if (!res.ok) throw new Error('pluggy_auth_failed')
  const data = await res.json() as { apiKey: string }

  _cachedApiKey = data.apiKey
  _cachedApiKeyExpiresAt = Date.now() + (115 * 60 * 1000) // 1h55min
  return _cachedApiKey
}

// POST /api/pluggy/connect-token — gera token para o Connect Widget no frontend
router.post('/connect-token', async (c) => {
  let apiKey: string
  try {
    apiKey = await getPluggyApiKey()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'internal_error'
    return c.json({ error: msg === 'pluggy_not_configured' ? msg : 'pluggy_connect_token_failed' }, 502)
  }

  const res = await fetch(`${PLUGGY_API}/connect_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    body: JSON.stringify({}),
  })
  if (!res.ok) return c.json({ error: 'pluggy_connect_token_failed' }, 502)
  const { accessToken } = await res.json() as { accessToken: string }
  return c.json({ accessToken })
})

// POST /api/pluggy/connect — salva o item_id retornado pelo widget
router.post('/connect', async (c) => {
  const userId = c.get('userId')
  const db     = createServiceClient()
  const body   = await c.req.json<{ bank_id?: string; item_id?: string }>()
  const { bank_id, item_id } = body
  if (!bank_id || !item_id) return c.json({ error: 'bank_id_and_item_id_required' }, 400)

  const { data: bank } = await db.from('banks').select('company_id').eq('id', bank_id).single()
  if (!bank) return c.json({ error: 'not_found' }, 404)

  const member = await ensureCompanyMember(db, userId, bank.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { data, error } = await db.from('banks')
    .update({ pluggy_item_id: item_id, sync_enabled: true })
    .eq('id', bank_id)
    .select()
    .single()
  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json(data)
})

// DELETE /api/pluggy/disconnect/:bankId — desconecta e remove o item do Pluggy
router.delete('/disconnect/:bankId', async (c) => {
  const userId = c.get('userId')
  const db     = createServiceClient()
  const bankId = c.req.param('bankId')

  const { data: bank } = await db.from('banks')
    .select('company_id, pluggy_item_id')
    .eq('id', bankId)
    .single()
  if (!bank) return c.json({ error: 'not_found' }, 404)

  const member = await ensureCompanyMember(db, userId, bank.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  if (bank.pluggy_item_id) {
    try {
      const apiKey = await getPluggyApiKey()
      await fetch(`${PLUGGY_API}/items/${bank.pluggy_item_id}`, {
        method: 'DELETE',
        headers: { 'X-API-KEY': apiKey },
      })
    } catch { /* best-effort — não bloqueia a desconexão local se o Pluggy falhar */ }
  }

  const { error } = await db.from('banks')
    .update({ pluggy_item_id: null, sync_enabled: false, last_synced_at: null })
    .eq('id', bankId)
  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json({ ok: true })
})

// POST /api/pluggy/sync/:bankId — sincronização manual (botão "Resincronizar")
router.post('/sync/:bankId', async (c) => {
  const userId = c.get('userId')
  const db     = createServiceClient()
  const bankId = c.req.param('bankId')

  const { data: bank } = await db.from('banks')
    .select('company_id, pluggy_item_id, last_synced_at')
    .eq('id', bankId)
    .single()
  if (!bank)                  return c.json({ error: 'not_found' }, 404)
  if (!bank.pluggy_item_id)  return c.json({ error: 'bank_not_connected' }, 400)

  const member = await ensureCompanyMember(db, userId, bank.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  let apiKey: string
  try {
    apiKey = await getPluggyApiKey()
  } catch {
    return c.json({ error: 'pluggy_auth_failed' }, 502)
  }

  const from = bank.last_synced_at
    ? bank.last_synced_at.slice(0, 10)
    : (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10) })()

  const imported = await syncItemTransactions(db, apiKey, bank.pluggy_item_id, bankId, bank.company_id, from)

  await db.from('banks')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', bankId)

  return c.json({ imported })
})

// ── Helpers compartilhados com a Edge Function ────────────────

interface PluggyTransaction {
  id: string
  description: string
  descriptionRaw: string | null
  amount: number
  amountInAccountCurrency: number
  date: string
  type: 'DEBIT' | 'CREDIT'
  category: string | null
}

interface PluggyPagedResult<T> {
  total: number
  totalPages: number
  page: number
  results: T[]
}

async function fetchTransactionsPaged(
  apiKey: string,
  accountId: string,
  from: string,
): Promise<PluggyTransaction[]> {
  const all: PluggyTransaction[] = []
  let page = 1
  while (true) {
    const res = await fetch(
      `${PLUGGY_API}/transactions?accountId=${accountId}&from=${from}&pageSize=500&page=${page}`,
      { headers: { 'X-API-KEY': apiKey } },
    )
    if (!res.ok) break
    const data = await res.json() as PluggyPagedResult<PluggyTransaction>
    all.push(...data.results)
    if (data.page >= data.totalPages) break
    page++
  }
  return all
}

type DB = ReturnType<typeof createServiceClient>

export async function syncItemTransactions(
  db: DB,
  apiKey: string,
  itemId: string,
  bankId: string,
  companyId: string,
  from: string,
): Promise<number> {
  const accountsRes = await fetch(`${PLUGGY_API}/accounts?itemId=${itemId}`, {
    headers: { 'X-API-KEY': apiKey },
  })
  if (!accountsRes.ok) return 0
  const { results: accounts } = await accountsRes.json() as PluggyPagedResult<{ id: string }>

  let imported = 0
  for (const account of accounts) {
    const txns = await fetchTransactionsPaged(apiKey, account.id, from)

    for (const tx of txns) {
      const type        = tx.type === 'CREDIT' ? 'income' : 'expense'
      const amount      = Math.round(Math.abs(tx.amountInAccountCurrency ?? tx.amount) * 100)
      const date        = tx.date.slice(0, 10)
      const counterpart = (tx.descriptionRaw ?? tx.description ?? '').slice(0, 255)

      const { error } = await db.from('transactions').insert({
        company_id:     companyId,
        external_id:    tx.id,
        type,
        amount,
        date,
        counterpart,
        description:    tx.description ?? counterpart,
        is_paid:        true,
        paid_at:        date,
        bank_id:        bankId,
        payment_method: 'bank',
      })

      // 23505 = unique_violation — transação já importada, ignorar
      if (!error || (error as unknown as { code: string }).code === '23505') {
        if (!error) imported++
      }
    }
  }

  return imported
}

// POST /api/pluggy/webhook — recebe eventos do Pluggy (sem auth, sem originGuard)
// A autenticidade é verificada via HMAC-SHA256 no header X-Pluggy-Signature
router.post('/webhook', async (c) => {
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET
  if (!clientSecret) return c.json({ error: 'pluggy_not_configured' }, 500)

  const rawBody   = await c.req.text()
  const signature = c.req.header('X-Pluggy-Signature') ?? ''
  const expected  = await computeHmac(clientSecret, rawBody)

  if (signature !== expected) return c.json({ error: 'invalid_signature' }, 401)

  let payload: { event?: string; itemId?: string }
  try { payload = JSON.parse(rawBody) } catch { return c.json({ error: 'invalid_json' }, 400) }

  if (payload.event !== 'item/updated' || !payload.itemId) {
    return c.json({ ok: true, skipped: true })
  }

  const db = createServiceClient()
  const { data: bank } = await db.from('banks')
    .select('id, company_id, last_synced_at')
    .eq('pluggy_item_id', payload.itemId)
    .eq('sync_enabled', true)
    .maybeSingle()

  if (!bank) return c.json({ ok: true, skipped: true })

  let apiKey: string
  try { apiKey = await getPluggyApiKey() } catch {
    return c.json({ error: 'pluggy_auth_failed' }, 502)
  }

  const from = bank.last_synced_at
    ? bank.last_synced_at.slice(0, 10)
    : (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10) })()

  const imported = await syncItemTransactions(db, apiKey, payload.itemId, bank.id, bank.company_id, from)

  await db.from('banks').update({ last_synced_at: new Date().toISOString() }).eq('id', bank.id)

  return c.json({ ok: true, imported })
})

async function computeHmac(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  return 'sha256=' + Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default router
