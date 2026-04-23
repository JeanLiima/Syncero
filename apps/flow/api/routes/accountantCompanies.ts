import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

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

router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<{ companyId: string; email: string; invite_token: string }>()
  const { companyId, email, invite_token } = body

  if (!companyId || !email || !invite_token) {
    return c.json({ error: 'companyId, email e invite_token são obrigatórios' }, 400)
  }

  const admin = await ensureCompanyAdmin(db, userId, companyId)
  if (!admin) return c.json({ error: 'forbidden' }, 403)

  const { data, error } = await db.from('accountant_companies')
    .insert({ company_id: companyId, email, status: 'pending', invite_token })
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 400)
  return c.json(data, 201)
})

export default router
