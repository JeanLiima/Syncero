import { Hono } from 'hono'
import { Resend } from 'resend'
import { createServiceClient, type HonoVariables } from '../_shared'
import { accountantInviteEmail } from '../emails/accountantInvite'

const router = new Hono<{ Variables: HonoVariables }>()

async function ensureCompanyMember(db: ReturnType<typeof createServiceClient>, userId: string, companyId: string) {
  const { data } = await db.from('company_members')
    .select('id')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('status', 'accepted')
    .maybeSingle()
  return data
}

async function ensureCompanyAdmin(db: ReturnType<typeof createServiceClient>, userId: string, companyId: string) {
  const { data } = await db.from('company_members')
    .select('id')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('status', 'accepted')
    .eq('role', 'admin')
    .maybeSingle()
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

  if (error) console.error('Failed to send invite email:', error)
  return !error
}

// ── GET /api/accountant-companies ─────────────────────────────
router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const companyId = c.req.query('companyId')

  if (companyId) {
    const member = await ensureCompanyMember(db, userId, companyId)
    if (!member) return c.json({ error: 'forbidden' }, 403)

    const { data, error } = await db.from('accountant_companies')
      .select('*, profiles!accountant_id(id, full_name, email, avatar_url)')
      .eq('company_id', companyId)
      .order('invited_at', { ascending: false })
    if (error) return c.json({ error: error.message }, 400)
    return c.json(data)
  }

  const { data, error } = await db.from('accountant_companies')
    .select('*, companies(id, name, cnpj, tax_regime)')
    .eq('accountant_id', userId)
    .eq('status', 'accepted')
    .order('accepted_at', { ascending: false })

  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})

// ── POST /api/accountant-companies ────────────────────────────
router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<{ companyId: string; email: string; invite_token: string; language?: 'pt' | 'en' }>()
  const { companyId, email, invite_token, language } = body

  if (!companyId || !email || !invite_token) {
    return c.json({ error: 'companyId, email and invite_token are required' }, 400)
  }

  const admin = await ensureCompanyAdmin(db, userId, companyId)
  if (!admin) return c.json({ error: 'forbidden' }, 403)

  // Rule: each company may have at most one accountant (accepted or pending).
  const { data: existing } = await db.from('accountant_companies')
    .select('id, status')
    .eq('company_id', companyId)
    .in('status', ['accepted', 'pending'])
    .maybeSingle()

  if (existing) {
    if (existing.status === 'accepted') {
      return c.json({ error: 'This company already has an accountant.' }, 409)
    }
    if (existing.status === 'pending') {
      return c.json({ error: 'An invite is already pending for this company.' }, 409)
    }
  }

  const [{ data: company }, { data: inviter }] = await Promise.all([
    db.from('companies').select('name').eq('id', companyId).single(),
    db.from('profiles').select('full_name').eq('id', userId).single(),
  ])

  const { data, error } = await db.from('accountant_companies')
    .insert({ company_id: companyId, email, status: 'pending', invite_token, invited_by: userId })
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 400)

  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    await sendInviteEmail({
      resendKey,
      to: email,
      inviteToken: invite_token,
      companyName: company?.name ?? 'the company',
      inviterName: inviter?.full_name ?? 'A company admin',
      language,
    })
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

  if (!invite) return c.json({ error: 'Invite not found.' }, 404)
  if (invite.status !== 'pending') return c.json({ error: 'Only pending invites can be resent.' }, 400)

  const admin = await ensureCompanyAdmin(db, userId, invite.company_id)
  if (!admin) return c.json({ error: 'forbidden' }, 403)

  // Rotate the token so the old link is invalidated
  const new_token = crypto.randomUUID()
  const { error: updateError } = await db.from('accountant_companies')
    .update({ invite_token: new_token, invited_at: new Date().toISOString() })
    .eq('id', id)

  if (updateError) return c.json({ error: updateError.message }, 400)

  const [{ data: company }, { data: inviter }] = await Promise.all([
    db.from('companies').select('name').eq('id', invite.company_id).single(),
    db.from('profiles').select('full_name').eq('id', userId).single(),
  ])

  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    await sendInviteEmail({
      resendKey,
      to: invite.email,
      inviteToken: new_token,
      companyName: company?.name ?? 'the company',
      inviterName: inviter?.full_name ?? 'A company admin',
    })
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

  if (!invite) return c.json({ error: 'Invite not found.' }, 404)
  if (invite.status === 'revoked') return c.json({ error: 'Already revoked.' }, 400)

  const admin = await ensureCompanyAdmin(db, userId, invite.company_id)
  if (!admin) return c.json({ error: 'forbidden' }, 403)

  const { error } = await db.from('accountant_companies').delete().eq('id', id)
  if (error) return c.json({ error: error.message }, 400)

  return c.json({ ok: true })
})

export default router
