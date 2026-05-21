import { Hono } from 'hono'
import { Resend } from 'resend'
import { createServiceClient, ensureCompanyMember, ensureCompanyAdmin, type HonoVariables } from '../_shared'
import { memberInviteEmail } from '../emails/_memberInvite'

const router = new Hono<{ Variables: HonoVariables }>()

router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const companyId = c.req.query('company_id')
  if (!companyId) return c.json({ error: 'company_id_required' }, 400)

  const member = await ensureCompanyMember(db, userId, companyId)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { data, error } = await db.from('company_members')
    .select('*, profiles!company_members_user_id_fkey(id, full_name, email, avatar_url)')
    .eq('company_id', companyId)
    .order('invited_at', { ascending: false })
  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json(data)
})

router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<{ company_id: string; email: string; role: string; invite_token: string; language?: 'pt' | 'en' }>()
  const { company_id: companyId, email, role, invite_token, language } = body

  if (!companyId || !email || !invite_token) {
    return c.json({ error: 'validation_error' }, 400)
  }

  const admin = await ensureCompanyAdmin(db, userId, companyId)
  if (!admin) return c.json({ error: 'forbidden' }, 403)

  const { data: existing } = await db.from('company_members')
    .select('id, status')
    .eq('company_id', companyId)
    .eq('email', email)
    .in('status', ['accepted', 'pending'])
    .maybeSingle()

  if (existing) {
    const msg = existing.status === 'accepted'
      ? 'member_already_exists'
      : 'invite_pending_for_email'
    return c.json({ error: msg }, 409)
  }

  const [companyRes, inviterRes] = await Promise.all([
    db.from('companies').select('name').eq('id', companyId).single(),
    db.from('profiles').select('full_name').eq('id', userId).single(),
  ])
  const companyName = companyRes.data?.name ?? ''
  const inviterName = inviterRes.data?.full_name ?? ''

  const { data, error } = await db.from('company_members')
    .insert({ company_id: companyId, email, role, status: 'pending', invite_token })
    .select()
    .single()

  if (error) return c.json({ error: 'internal_error' }, 500)

  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    const isProduction = process.env.VERCEL_ENV === 'production'
    const flowUrl = isProduction
      ? process.env.VITE_FLOW_URL ?? 'https://syncero-flow.vercel.app'
      : 'http://localhost:5174'
    const inviteLink = `${flowUrl}/invite/${invite_token}`

    const { subject, html } = memberInviteEmail({ companyName, inviterName, inviteLink, language })
    const resend = new Resend(resendKey)
    const { error: emailError } = await resend.emails.send({
      from: 'Syncero <onboarding@resend.dev>',
      to: email,
      subject,
      html,
    })
    if (emailError) console.error('Failed to send member invite email:', emailError.message)
  } else {
    console.warn('RESEND_API_KEY not set — invite created but email not sent')
  }

  return c.json(data, 201)
})

// ── PATCH /api/company-members/:id/role ───────────────────────
router.patch('/:id/role', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const id = c.req.param('id')
  const { role } = await c.req.json<{ role: string }>()

  if (!role) return c.json({ error: 'validation_error' }, 400)

  const row = await db.from('company_members').select('company_id, user_id').eq('id', id).single()
  if (!row.data) return c.json({ error: 'not_found' }, 404)

  const admin = await ensureCompanyAdmin(db, userId, row.data.company_id)
  if (!admin) return c.json({ error: 'forbidden' }, 403)

  if (role !== 'admin') {
    const { data: target } = await db.from('company_members').select('role').eq('id', id).maybeSingle()
    if (target?.role === 'admin') {
      const { count } = await db.from('company_members')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', row.data.company_id)
        .eq('role', 'admin')
        .eq('status', 'accepted')
      if ((count ?? 0) <= 1) return c.json({ error: 'last_admin_demotion' }, 400)
    }
  }

  const { error } = await db.from('company_members').update({ role }).eq('id', id)
  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json({ ok: true })
})

// ── POST /api/company-members/:id/resend ──────────────────────
router.post('/:id/resend', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const id = c.req.param('id')

  const { data: invite } = await db.from('company_members')
    .select('id, company_id, email, status, invite_token')
    .eq('id', id)
    .maybeSingle()

  if (!invite) return c.json({ error: 'not_found' }, 404)
  if (invite.status !== 'pending') return c.json({ error: 'invite_not_pending' }, 400)

  const admin = await ensureCompanyAdmin(db, userId, invite.company_id)
  if (!admin) return c.json({ error: 'forbidden' }, 403)

  const new_token = crypto.randomUUID()
  const { error: updateError } = await db.from('company_members')
    .update({ invite_token: new_token, invited_at: new Date().toISOString() })
    .eq('id', id)
  if (updateError) return c.json({ error: 'internal_error' }, 500)

  const [companyRes, inviterRes] = await Promise.all([
    db.from('companies').select('name').eq('id', invite.company_id).single(),
    db.from('profiles').select('full_name').eq('id', userId).single(),
  ])

  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    const isProduction = process.env.VERCEL_ENV === 'production'
    const flowUrl = isProduction ? process.env.VITE_FLOW_URL ?? 'https://syncero-flow.vercel.app' : 'http://localhost:5174'
    const { subject, html } = memberInviteEmail({
      companyName: companyRes.data?.name ?? '',
      inviterName: inviterRes.data?.full_name ?? '',
      inviteLink: `${flowUrl}/invite/${new_token}`,
    })
    const resendClient = new Resend(resendKey)
    await resendClient.emails.send({ from: 'Syncero <onboarding@resend.dev>', to: invite.email!, subject, html })
  }

  return c.json({ ok: true })
})

// ── DELETE /api/company-members/:id ───────────────────────────
router.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const id = c.req.param('id')

  const { data: invite } = await db.from('company_members')
    .select('id, company_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!invite) return c.json({ error: 'not_found' }, 404)

  const admin = await ensureCompanyAdmin(db, userId, invite.company_id)
  if (!admin) return c.json({ error: 'forbidden' }, 403)

  const { error } = await db.from('company_members').delete().eq('id', id)
  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json({ ok: true })
})

export default router
