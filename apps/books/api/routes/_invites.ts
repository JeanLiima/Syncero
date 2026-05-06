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

  return c.json({ error: 'Invite not found.' }, 404)
})

// ── POST /api/invites/:token/accept (with auth) ────────────────
router.post('/:token/accept', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { token } = c.req.param()

  const { data: profile } = await db.from('profiles')
    .select('user_type, email').eq('id', userId).maybeSingle()

  if (!profile) return c.json({ error: 'Profile not found. Please complete your account setup first.' }, 403)
  if (profile.user_type !== 'accountant') return c.json({ error: 'Only accountant accounts can accept this invite.' }, 403)

  const { data: invite } = await db.from('accountant_companies')
    .select('id, status, email').eq('invite_token', token).maybeSingle()

  if (!invite) return c.json({ error: 'Invite not found.' }, 404)
  if (invite.status !== 'pending') return c.json({ error: 'This invite has already been used or has expired.' }, 400)

  // Garantir que o convite pertence ao e-mail do contador autenticado
  if (profile.email.toLowerCase() !== (invite.email ?? '').toLowerCase()) {
    return c.json({ error: 'This invite was sent to a different email address.' }, 403)
  }

  const { error } = await db.from('accountant_companies')
    .update({ status: 'accepted', accountant_id: userId, accepted_at: new Date().toISOString() })
    .eq('invite_token', token)

  if (error) return c.json({ error: error.message }, 400)

  return c.json({ ok: true })
})

export default router
