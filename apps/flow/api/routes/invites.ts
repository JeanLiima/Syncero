import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

// ── GET /api/invites/:token (no auth required) ─────────────────
// NOTE: This endpoint reveals company info without auth. Consider rate limiting or auth requirement.
router.get('/:token', async (c) => {
  const db = createServiceClient()
  const { token } = c.req.param()

  const { data: member } = await db.from('company_members')
    .select('id, status, companies(name)').eq('invite_token', token).maybeSingle()
  if (member) {
    const company = member.companies as unknown as { name: string } | null
    return c.json({ type: 'member', companyName: company?.name ?? '', status: member.status })
  }

  return c.json({ error: 'Invite not found' }, 404)
})

// ── POST /api/invites/:token/accept (with auth) ────────────────
router.post('/:token/accept', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { token } = c.req.param()

  const { data: member } = await db.from('company_members')
    .select('id, status').eq('invite_token', token).maybeSingle()

  if (!member) return c.json({ error: 'Invite not found' }, 404)
  if (member.status !== 'pending') return c.json({ error: 'This invite has already been used or has expired' }, 400)

  const { error } = await db.from('company_members')
    .update({ status: 'accepted', user_id: userId }).eq('invite_token', token)
  if (error) return c.json({ error: 'Failed to accept invite' }, 500)

  return c.json({ ok: true })
})

export default router
