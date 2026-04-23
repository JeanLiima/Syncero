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

router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const companyId = c.req.query('companyId')
  if (!companyId) return c.json({ error: 'companyId é obrigatório' }, 400)

  const member = await ensureCompanyMember(db, userId, companyId)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const docType = c.req.query('doc_type')
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')

  let query = db.from('fiscal_documents').select('*').eq('company_id', companyId).order('issue_date', { ascending: false })
  if (docType) query = query.eq('doc_type', docType)
  if (dateFrom) query = query.gte('issue_date', dateFrom)
  if (dateTo) query = query.lte('issue_date', dateTo)

  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})

export default router
