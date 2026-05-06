import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

async function ensureCompanyAccess(db: ReturnType<typeof createServiceClient>, userId: string, companyId: string) {
  const [member, accountant] = await Promise.all([
    db.from('company_members').select('id').eq('user_id', userId).eq('company_id', companyId).eq('status', 'accepted').maybeSingle(),
    db.from('accountant_companies').select('id').eq('accountant_id', userId).eq('company_id', companyId).eq('status', 'accepted').maybeSingle(),
  ])
  return Boolean(member.data || accountant.data)
}

router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const companyId = c.req.query('company_id')
  if (!companyId) return c.json({ error: 'company_id é obrigatório' }, 400)

  const access = await ensureCompanyAccess(db, userId, companyId)
  if (!access) return c.json({ error: 'forbidden' }, 403)

  const { data, error } = await db.from('fiscal_books')
    .select('*')
    .eq('company_id', companyId)
    .order('reference_period', { ascending: false })
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})

export default router
