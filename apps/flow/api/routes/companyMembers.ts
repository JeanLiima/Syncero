import { Hono } from 'hono'
import { Resend } from 'resend'
import { createServiceClient, type HonoVariables } from '../_shared'
import { memberInviteEmail } from '../emails/memberInvite'

const router = new Hono<{ Variables: HonoVariables }>()

async function ensureCompanyMember(db: ReturnType<typeof createServiceClient>, userId: string, companyId: string) {
  const { data } = await db.from('company_members')
    .select('id, role, status')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('status', 'accepted')
    .maybeSingle()
  return data
}

async function ensureCompanyAdmin(db: ReturnType<typeof createServiceClient>, userId: string, companyId: string) {
  const { data } = await db.from('company_members')
    .select('id, role')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('status', 'accepted')
    .eq('role', 'admin')
    .maybeSingle()
  return data
}

router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const companyId = c.req.query('companyId')
  if (!companyId) return c.json({ error: 'companyId é obrigatório' }, 400)

  const member = await ensureCompanyMember(db, userId, companyId)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { data, error } = await db.from('company_members')
    .select('*, profiles(id, full_name, email, avatar_url)')
    .eq('company_id', companyId)
    .order('invited_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})

router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<{ companyId: string; email: string; role: string; invite_token: string; language?: 'pt' | 'en' }>()
  const { companyId, email, role, invite_token, language } = body

  if (!companyId || !email || !invite_token) {
    return c.json({ error: 'companyId, email e invite_token são obrigatórios' }, 400)
  }

  const admin = await ensureCompanyAdmin(db, userId, companyId)
  if (!admin) return c.json({ error: 'forbidden' }, 403)

  // Verificar se já existe convite pendente para este email nesta empresa
  const { data: existing } = await db.from('company_members')
    .select('id, status')
    .eq('company_id', companyId)
    .eq('email', email)
    .in('status', ['accepted', 'pending'])
    .maybeSingle()

  if (existing) {
    const msg = existing.status === 'accepted'
      ? 'Este usuário já é membro da empresa.'
      : 'Já existe um convite pendente para este e-mail.'
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

  if (error) return c.json({ error: error.message }, 400)

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

router.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const id = c.req.param('id')
  const data = await c.req.json<{ status?: string }>()

  const row = await db.from('company_members').select('company_id').eq('id', id).single()
  if (!row.data) return c.json({ error: 'not found' }, 404)

  const admin = await ensureCompanyAdmin(db, userId, row.data.company_id)
  if (!admin) return c.json({ error: 'forbidden' }, 403)

  const { error } = await db.from('company_members').update(data).eq('id', id)
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ ok: true })
})

export default router
