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

// ── GET /api/accountant-companies ─────────────────────────────
router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const companyId = c.req.query('companyId')

  if (companyId) {
    const member = await ensureCompanyMember(db, userId, companyId)
    if (!member) return c.json({ error: 'forbidden' }, 403)

    const { data, error } = await db.from('accountant_companies')
      .select('*, profiles(id, full_name, email, avatar_url)')
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
  const body = await c.req.json<{ companyId: string; email: string; invite_token: string }>()
  const { companyId, email, invite_token } = body

  if (!companyId || !email || !invite_token) {
    return c.json({ error: 'companyId, email and invite_token are required' }, 400)
  }

  const admin = await ensureCompanyAdmin(db, userId, companyId)
  if (!admin) return c.json({ error: 'forbidden' }, 403)

  // Check for existing pending invite to the same email
  const { data: existing } = await db.from('accountant_companies')
    .select('id, status')
    .eq('company_id', companyId)
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'accepted') {
      return c.json({ error: 'This accountant already has access to this company.' }, 409)
    }
    if (existing.status === 'pending') {
      return c.json({ error: 'An invite has already been sent to this email.' }, 409)
    }
  }

  // Get company name + inviter name for the email
  const [{ data: company }, { data: inviter }] = await Promise.all([
    db.from('companies').select('name').eq('id', companyId).single(),
    db.from('profiles').select('full_name').eq('id', userId).single(),
  ])

  const { data, error } = await db.from('accountant_companies')
    .insert({
      company_id: companyId,
      email,
      status: 'pending',
      invite_token,
      invited_by: userId,
    })
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 400)

  // Send invite email via Resend
  const resendKey = process.env.RESEND_API_KEY
  
  const vercelEnv = process.env.VERCEL_ENV ?? ''
  let flowUrl: string 

  if (vercelEnv === 'production') {
    flowUrl    = process.env.VITE_FLOW_URL    ?? 'https://syncero-flow.vercel.app'
  } else {
    flowUrl    = process.env.VITE_FLOW_URL    ?? 'http://localhost:5174'
  }

  if (resendKey) {
    const resend = new Resend(resendKey)
    const inviteLink = `${flowUrl}/invite/${invite_token}`
    const { subject, html } = accountantInviteEmail({
      companyName: company?.name ?? 'the company',
      inviterName: inviter?.full_name ?? 'A company admin',
      inviteLink,
    })

    const { error: emailError } = await resend.emails.send({
      from: 'Syncero <noreply@syncero.com.br>',
      to: email,
      subject,
      html,
    })

    if (emailError) {
      console.error('Failed to send invite email:', emailError)
      // Don't fail the request — invite was created, email is best-effort
    }
  } else {
    console.warn('RESEND_API_KEY not set — invite created but email not sent')
  }

  return c.json(data, 201)
})

export default router
