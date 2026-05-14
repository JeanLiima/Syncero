import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

async function ensureAccess(
  db: ReturnType<typeof createServiceClient>,
  userId: string,
  companyId: string | null,
  extCompanyId: string | null,
): Promise<boolean> {
  if (companyId) {
    const [member, accountant] = await Promise.all([
      db.from('company_members').select('id').eq('user_id', userId).eq('company_id', companyId).eq('status', 'accepted').maybeSingle(),
      db.from('accountant_companies').select('id').eq('accountant_id', userId).eq('company_id', companyId).eq('status', 'accepted').maybeSingle(),
    ])
    return Boolean(member.data || accountant.data)
  }
  if (extCompanyId) {
    const { data } = await db.from('external_companies').select('id').eq('id', extCompanyId).eq('accountant_id', userId).maybeSingle()
    return Boolean(data)
  }
  return false
}

// GET /api/fiscal-documents?company_id=... ou ?ext_company_id=...
router.get('/', async (c) => {
  const userId       = c.get('userId')
  const db           = createServiceClient()
  const companyId    = c.req.query('company_id')    ?? null
  const extCompanyId = c.req.query('ext_company_id') ?? null

  if (!companyId && !extCompanyId) return c.json({ error: 'company_id ou ext_company_id obrigatório' }, 400)

  const ok = await ensureAccess(db, userId, companyId, extCompanyId)
  if (!ok) return c.json({ error: 'forbidden' }, 403)

  const docType   = c.req.query('doc_type')
  const direction = c.req.query('direction')
  const docStatus = c.req.query('status')
  const pending   = c.req.query('pending')
  const dateFrom  = c.req.query('date_from')
  const dateTo    = c.req.query('date_to')
  const page      = Number(c.req.query('page') ?? '1')
  const pageSize  = Math.min(Number(c.req.query('page_size') ?? '20'), 200)

  let query = db.from('fiscal_documents')
    .select('*', { count: 'exact' })
    .order('issue_date', { ascending: false })

  if (companyId)    query = query.eq('company_id', companyId)
  if (extCompanyId) query = query.eq('company_id', extCompanyId) // ext company reuses company_id FK via sefaz-sync

  if (docType)   query = query.eq('doc_type', docType)
  if (direction) query = query.eq('doc_direction', direction)
  if (docStatus) query = query.eq('doc_status', docStatus)
  if (pending === 'true') query = query.is('transaction_id', null)
  if (dateFrom)  query = query.gte('issue_date', dateFrom)
  if (dateTo)    query = query.lte('issue_date', dateTo)

  query = query.range((page - 1) * pageSize, page * pageSize - 1)

  const { data, error, count } = await query
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ data, count })
})

export default router
