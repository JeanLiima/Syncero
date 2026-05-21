import { Hono } from 'hono'
import { Resend } from 'resend'
import { createServiceClient, type HonoVariables } from '../_shared'
import { accountantInviteEmail } from '../emails/_accountantInvite'

const router = new Hono<{ Variables: HonoVariables }>()

async function checkCompanyAccess(db: ReturnType<typeof createServiceClient>, userId: string, companyId: string, requireAdmin = false) {
  let query = db.from('company_members')
    .select('id')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('status', 'accepted')
  
  if (requireAdmin) {
    query = query.eq('role', 'admin')
  }
  
  const { data } = await query.maybeSingle()
  return data
}

async function sendInviteEmail(opts: {
  resendKey: string
  to: string
  inviteToken: string
  companyName: string
  inviterName: string
  language?: 'pt' | 'en'
}) {
  const isProduction = process.env.VERCEL_ENV === 'production'
  const booksUrl = (isProduction ? process.env.VITE_BOOKS_URL ?? 'https://syncero-books.vercel.app' : 'http://localhost:5175')
  const inviteLink = `${booksUrl}/invite/${opts.inviteToken}`
  const { subject, html } = accountantInviteEmail({
    companyName: opts.companyName,
    inviterName: opts.inviterName,
    inviteLink,
    language: opts.language,
  })

  const resend = new Resend(opts.resendKey)
  const { error } = await resend.emails.send({
    from: 'Syncero <onboarding@resend.dev>',
    to: opts.to,
    subject,
    html,
  })

  if (error) {
    console.error('Failed to send invite email:', error.message) // Sanitized error
    return false
  }
  return true
}

async function getCompanyAndInviter(db: ReturnType<typeof createServiceClient>, companyId: string, userId: string) {
  const [companyRes, inviterRes] = await Promise.all([
    db.from('companies').select('name').eq('id', companyId).single(),
    db.from('profiles').select('full_name').eq('id', userId).single(),
  ])
  return {
    companyName: companyRes.data?.name ?? 'the company',
    inviterName: inviterRes.data?.full_name ?? 'A company admin'
  }
}

// ── GET /api/accountant-companies ─────────────────────────────
router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const companyId = c.req.query('company_id')

  if (companyId) {
    const member = await checkCompanyAccess(db, userId, companyId, false)
    if (!member) return c.json({ error: 'forbidden' }, 403)

    const { data, error } = await db.from('accountant_companies')
      .select('*, profiles!accountant_id(id, full_name, email, avatar_url)')
      .eq('company_id', companyId)
      .order('invited_at', { ascending: false })
    if (error) return c.json({ error: 'internal_error' }, 500)
    return c.json(data)
  }

  const { data, error } = await db.from('accountant_companies')
    .select('*, companies(id, name, cnpj, tax_regime)')
    .eq('accountant_id', userId)
    .eq('status', 'accepted')
    .order('accepted_at', { ascending: false })

  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json(data)
})

// ── POST /api/accountant-companies ────────────────────────────
router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<{ company_id: string; email: string; invite_token: string; language?: 'pt' | 'en' }>()
  const { company_id: companyId, email, invite_token, language } = body

  if (!companyId || !email || !invite_token) {
    return c.json({ error: 'validation_error' }, 400)
  }

  const admin = await checkCompanyAccess(db, userId, companyId, true)
  if (!admin) return c.json({ error: 'forbidden' }, 403)

  // Rule: each company may have at most one accountant (accepted or pending).
  const { data: existing } = await db.from('accountant_companies')
    .select('id, status')
    .eq('company_id', companyId)
    .in('status', ['accepted', 'pending'])
    .maybeSingle()

  if (existing) {
    if (existing.status === 'accepted') {
      return c.json({ error: 'accountant_already_linked' }, 409)
    }
    if (existing.status === 'pending') {
      return c.json({ error: 'accountant_invite_pending' }, 409)
    }
  }

  const { companyName, inviterName } = await getCompanyAndInviter(db, companyId, userId)

  const { data, error } = await db.from('accountant_companies')
    .insert({ company_id: companyId, email, status: 'pending', invite_token, invited_by: userId })
    .select()
    .single()

  if (error) return c.json({ error: 'internal_error' }, 500)

  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    const emailSent = await sendInviteEmail({
      resendKey,
      to: email,
      inviteToken: invite_token,
      companyName,
      inviterName,
      language,
    })
    if (!emailSent) {
      console.warn('Invite created but email failed to send')
    }
  } else {
    console.warn('RESEND_API_KEY not set — invite created but email not sent')
  }

  return c.json(data, 201)
})

// ── POST /api/accountant-companies/:id/resend ─────────────────
router.post('/:id/resend', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: invite } = await db.from('accountant_companies')
    .select('id, company_id, email, status, invite_token')
    .eq('id', id)
    .maybeSingle()

  if (!invite) return c.json({ error: 'not_found' }, 404)
  if (invite.status !== 'pending') return c.json({ error: 'invite_not_pending' }, 400)

  const admin = await checkCompanyAccess(db, userId, invite.company_id, true)
  if (!admin) return c.json({ error: 'forbidden' }, 403)

  // Rotate the token so the old link is invalidated
  const new_token = crypto.randomUUID()
  const { error: updateError } = await db.from('accountant_companies')
    .update({ invite_token: new_token, invited_at: new Date().toISOString() })
    .eq('id', id)

  if (updateError) return c.json({ error: 'internal_error' }, 500)

  const { companyName, inviterName } = await getCompanyAndInviter(db, invite.company_id, userId)

  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    const emailSent = await sendInviteEmail({
      resendKey,
      to: invite.email,
      inviteToken: new_token,
      companyName,
      inviterName,
    })
    if (!emailSent) {
      console.warn('Resend failed')
    }
  }

  return c.json({ ok: true })
})

// ── DELETE /api/accountant-companies/:id ──────────────────────
router.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: invite } = await db.from('accountant_companies')
    .select('id, company_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!invite) return c.json({ error: 'not_found' }, 404)
  if (invite.status === 'revoked') return c.json({ error: 'already_revoked' }, 400)

  const admin = await checkCompanyAccess(db, userId, invite.company_id, true)
  if (!admin) return c.json({ error: 'forbidden' }, 403)

  const { error } = await db.from('accountant_companies').delete().eq('id', id)
  if (error) return c.json({ error: 'internal_error' }, 500)

  return c.json({ ok: true })
})

export default router
