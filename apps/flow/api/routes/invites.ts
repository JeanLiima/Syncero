import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

// ── GET /api/invites/:token (no auth required) ─────────────────
router.get('/:token', async (c) => {
  const db = createServiceClient()
  const { token } = c.req.param()

  const { data: acct } = await db.from('accountant_companies')
    .select('id, status, companies(name)').eq('invite_token', token).maybeSingle()
  if (acct) {
    const company = acct.companies as unknown as { name: string } | null
    return c.json({ type: 'accountant', companyName: company?.name ?? '', status: acct.status })
  }

  const { data: member } = await db.from('company_members')
    .select('id, status, companies(name)').eq('invite_token', token).maybeSingle()
  if (member) {
    const company = member.companies as unknown as { name: string } | null
    return c.json({ type: 'member', companyName: company?.name ?? '', status: member.status })
  }

  return c.json({ error: 'Convite não encontrado.' }, 404)
})

// ── POST /api/invites/:token/accept (with auth) ────────────────
router.post('/:token/accept', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { token } = c.req.param()
  const { type } = await c.req.json<{ type: 'accountant' | 'member' }>()

  if (type === 'accountant') {
    const { error } = await db.from('accountant_companies')
      .update({ status: 'accepted', accountant_id: userId }).eq('invite_token', token)
    if (error) return c.json({ error: error.message }, 400)
  } else {
    const { error } = await db.from('company_members')
      .update({ status: 'active', user_id: userId }).eq('invite_token', token)
    if (error) return c.json({ error: error.message }, 400)
  }

  return c.json({ ok: true })
})

export default router
