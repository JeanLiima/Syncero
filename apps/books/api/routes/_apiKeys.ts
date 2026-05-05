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
  const { companyId, extCompanyId } = c.req.query()

  if (!companyId && !extCompanyId) return c.json({ error: 'companyId or extCompanyId required' }, 400)

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
    name: string; expiresAt?: string | null
    companyId?: string; extCompanyId?: string
  }>()

  if (!body.companyId && !body.extCompanyId) return c.json({ error: 'companyId or extCompanyId required' }, 400)

  // Verificar que o contador tem acesso à empresa informada
  if (body.companyId) {
    const { data: acct } = await db.from('accountant_companies')
      .select('id').eq('accountant_id', userId).eq('company_id', body.companyId).eq('status', 'accepted').maybeSingle()
    if (!acct) return c.json({ error: 'Forbidden: not authorized for this company' }, 403)
  } else {
    const { data: ec } = await db.from('external_companies')
      .select('id').eq('id', body.extCompanyId!).eq('accountant_id', userId).maybeSingle()
    if (!ec) return c.json({ error: 'Forbidden: not authorized for this external company' }, 403)
  }

  const rawKey = generateRawKey()
  const hash = await sha256hex(rawKey)
  const prefix = rawKey.slice(0, 11)

  const { error } = await db.from('api_keys').insert({
    accountant_id: userId,
    name: body.name,
    company_id: body.extCompanyId ? null : (body.companyId ?? null),
    ext_company_id: body.extCompanyId ?? null,
    key_hash: hash,
    key_prefix: prefix,
    expires_at: body.expiresAt ?? null,
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

export default router
