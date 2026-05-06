import { Hono } from 'hono'
import { createServiceClient, sha256hex, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

function generateRawKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return 'sk_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── GET /api/api-keys ─────────────────────────────────────────
router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { company_id: companyId, ext_company_id: extCompanyId } = c.req.query()

  if (!companyId && !extCompanyId) return c.json({ error: 'company_id or ext_company_id required' }, 400)

  const q = db.from('api_keys')
    .select('*')
    .eq('accountant_id', userId)
    .order('created_at', { ascending: false })
  const { data, error } = companyId
    ? await q.eq('company_id', companyId)
    : await q.eq('ext_company_id', extCompanyId!)
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data ?? [])
})

// ── POST /api/api-keys ────────────────────────────────────────
router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<{
    name: string; expires_at?: string | null
    company_id?: string; ext_company_id?: string
  }>()

  if (!body.company_id && !body.ext_company_id) return c.json({ error: 'company_id or ext_company_id required' }, 400)

  // Verificar que o contador tem acesso à empresa informada
  if (body.company_id) {
    const { data: acct } = await db.from('accountant_companies')
      .select('id').eq('accountant_id', userId).eq('company_id', body.company_id).eq('status', 'accepted').maybeSingle()
    if (!acct) return c.json({ error: 'Forbidden: not authorized for this company' }, 403)
  } else {
    const { data: ec } = await db.from('external_companies')
      .select('id').eq('id', body.ext_company_id!).eq('accountant_id', userId).maybeSingle()
    if (!ec) return c.json({ error: 'Forbidden: not authorized for this external company' }, 403)
  }

  const rawKey = generateRawKey()
  const hash = await sha256hex(rawKey)
  const prefix = rawKey.slice(0, 11)

  const { error } = await db.from('api_keys').insert({
    accountant_id: userId,
    name: body.name,
    company_id: body.ext_company_id ? null : (body.company_id ?? null),
    ext_company_id: body.ext_company_id ?? null,
    key_hash: hash,
    key_prefix: prefix,
    // Se vier só a data (YYYY-MM-DD), interpreta como fim do dia UTC para evitar
    // expiração imediata quando a chave é criada depois de meia-noite.
    expires_at: body.expires_at
      ? (/^\d{4}-\d{2}-\d{2}$/.test(body.expires_at)
          ? body.expires_at + 'T23:59:59Z'
          : body.expires_at)
      : null,
  })
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ key: rawKey }, 201)
})

// ── PATCH /api/api-keys/:id/revoke ────────────────────────────
router.patch('/:id/revoke', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: existing } = await db.from('api_keys')
    .select('accountant_id').eq('id', id).maybeSingle()
  if (!existing || existing.accountant_id !== userId) return c.json({ error: 'forbidden' }, 403)

  const { error } = await db.from('api_keys').update({ is_active: false }).eq('id', id)
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ ok: true })
})

// ── DELETE /api/api-keys/:id ──────────────────────────────────
// Só permite excluir chaves já revogadas (is_active = false)
router.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: existing } = await db.from('api_keys')
    .select('accountant_id, is_active').eq('id', id).maybeSingle()
  if (!existing || existing.accountant_id !== userId) return c.json({ error: 'forbidden' }, 403)
  if (existing.is_active) return c.json({ error: 'Revoke the key before deleting it' }, 400)

  const { error } = await db.from('api_keys').delete().eq('id', id)
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ ok: true })
})

export default router
