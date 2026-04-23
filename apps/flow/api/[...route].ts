import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { authMiddleware, createServiceClient, type HonoVariables } from '@syncero/api'

export const config = { runtime: 'edge' }

const app = new Hono<{ Variables: HonoVariables }>().basePath('/api')

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

// ── Auth middleware ────────────────────────────────────────────
app.use('/me', authMiddleware)
app.use('/me/*', authMiddleware)
app.use('/companies/*', authMiddleware)
app.use('/invites/:token/accept', authMiddleware)

// ── GET /api/me ───────────────────────────────────────────────
app.get('/me', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()

  const [profileRes, memberRes] = await Promise.all([
    db.from('profiles')
      .select('id, full_name, email, user_type, avatar_url')
      .eq('id', userId)
      .single(),
    db.from('company_members')
      .select('role, companies(id, name)')
      .eq('user_id', userId)
      .eq('status', 'accepted')
      .limit(1)
      .maybeSingle(),
  ])

  let activeCompany = null
  if (memberRes.data?.companies) {
    const co = memberRes.data.companies as unknown as { id: string; name: string }
    activeCompany = { id: co.id, name: co.name, role: memberRes.data.role }
  }

  return c.json({ profile: profileRes.data, activeCompany })
})

// ── POST /api/me ──────────────────────────────────────────────
app.post('/me', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { user_type } = await c.req.json<{ user_type: string }>()

  const { data: { user } } = await db.auth.admin.getUserById(userId)
  const fullName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email?.split('@')[0] ?? 'Usuário'
  const avatarUrl = (user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null) as string | null

  const { error } = await db.from('profiles').upsert(
    { id: userId, full_name: fullName, email: user?.email ?? '', user_type, avatar_url: avatarUrl },
    { onConflict: 'id' }
  )
  if (error) return c.json({ error: error.message }, 400)

  const { data: profile } = await db.from('profiles')
    .select('id, full_name, email, user_type, avatar_url')
    .eq('id', userId)
    .single()

  return c.json({ profile })
})

// ── POST /api/companies ───────────────────────────────────────
app.post('/companies', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { name, cnpj, tax_regime } = await c.req.json<{ name: string; cnpj?: string; tax_regime?: string }>()

  if (!name?.trim()) return c.json({ error: 'Nome é obrigatório' }, 400)

  const payload: Record<string, unknown> = { name: name.trim(), owner_id: userId }
  if (cnpj) payload.cnpj = cnpj
  if (tax_regime) payload.tax_regime = tax_regime

  const { data, error } = await db.from('companies').insert(payload).select('id, name').single()
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data, 201)
})

// ── GET /api/companies/:id ────────────────────────────────────
app.get('/companies/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: member } = await db.from('company_members')
    .select('id').eq('user_id', userId).eq('company_id', id).eq('status', 'accepted').maybeSingle()
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { data } = await db.from('companies').select('id, name, cnpj, tax_regime').eq('id', id).single()
  return c.json(data)
})

// ── GET /api/companies/:id/fiscal-summary ─────────────────────
app.get('/companies/:id/fiscal-summary', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const [memberRes, accountantRes] = await Promise.all([
    db.from('company_members').select('id').eq('user_id', userId).eq('company_id', id).eq('status', 'accepted').maybeSingle(),
    db.from('accountant_companies').select('id').eq('accountant_id', userId).eq('company_id', id).eq('status', 'accepted').maybeSingle(),
  ])
  if (!memberRes.data && !accountantRes.data) return c.json({ error: 'forbidden' }, 403)

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const period = `${year}-${month}`

  const [nfe, books, taxes] = await Promise.all([
    db.from('fiscal_documents').select('id', { count: 'exact', head: true }).eq('company_id', id),
    db.from('fiscal_books').select('id', { count: 'exact', head: true }).eq('company_id', id),
    db.from('tax_calculations').select('tax_value').eq('company_id', id)
      .gte('reference_period', period).lte('reference_period', period),
  ])

  const taxTotal = taxes.data?.reduce((s, t) => s + (t.tax_value as number), 0) ?? 0
  return c.json({ nfeCount: nfe.count ?? 0, booksCount: books.count ?? 0, taxTotal })
})

// ── GET /api/invites/:token (no auth) ─────────────────────────
app.get('/invites/:token', async (c) => {
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

// ── POST /api/invites/:token/accept ───────────────────────────
app.post('/invites/:token/accept', async (c) => {
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

export default handle(app)
