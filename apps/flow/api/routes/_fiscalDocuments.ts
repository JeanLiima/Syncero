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

// GET /api/fiscal-documents?company_id=...&direction=...&status=...&pending=true&date_from=...&date_to=...&page=1&page_size=20
router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const companyId = c.req.query('company_id')
  if (!companyId) return c.json({ error: 'company_id é obrigatório' }, 400)

  const member = await ensureCompanyMember(db, userId, companyId)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const direction  = c.req.query('direction')
  const docType    = c.req.query('doc_type')
  const docStatus  = c.req.query('status')
  const pending    = c.req.query('pending')
  const dateFrom   = c.req.query('date_from')
  const dateTo     = c.req.query('date_to')
  const page       = Number(c.req.query('page') ?? '1')
  const pageSize   = Math.min(Number(c.req.query('page_size') ?? '20'), 200)

  let query = db.from('fiscal_documents')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .order('issue_date', { ascending: false })

  if (direction) query = query.eq('doc_direction', direction)
  if (docType)   query = query.eq('doc_type', docType)
  if (docStatus) query = query.eq('doc_status', docStatus)
  if (pending === 'true') query = query.is('transaction_id', null)
  if (dateFrom) query = query.gte('issue_date', dateFrom)
  if (dateTo)   query = query.lte('issue_date', dateTo)

  query = query.range((page - 1) * pageSize, page * pageSize - 1)

  const { data, error, count } = await query
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ data, count })
})

// PATCH /api/fiscal-documents/:id — vincula ou desvincula transaction_id
router.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const docId = c.req.param('id')

  const { data: doc } = await db.from('fiscal_documents').select('company_id').eq('id', docId).maybeSingle()
  if (!doc) return c.json({ error: 'not found' }, 404)

  const member = await ensureCompanyMember(db, userId, doc.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const body = await c.req.json<{ transaction_id?: string | null }>()
  if (!('transaction_id' in body)) return c.json({ error: 'transaction_id obrigatório' }, 400)

  const { data, error } = await db.from('fiscal_documents')
    .update({ transaction_id: body.transaction_id ?? null })
    .eq('id', docId)
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})

export default router
