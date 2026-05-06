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
  const companyId = c.req.query('company_id')
  if (!companyId) return c.json({ error: 'company_id é obrigatório' }, 400)

  const member = await ensureCompanyMember(db, userId, companyId)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const search = c.req.query('search')

  let query = db.from('contacts')
    .select('*')
    .eq('company_id', companyId)
    .order('name')

  if (search) {
    // Remover caracteres com significado na sintaxe de filtro PostgREST (.or string)
    const safe = search.replace(/[%_,()]/g, '')
    if (safe) query = query.or(`name.ilike.%${safe}%,cpf.ilike.%${safe}%,cnpj.ilike.%${safe}%`)
  }

  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})

router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<{ company_id: string; name: string; cpf?: string; cnpj?: string }>()

  if (!body.company_id) return c.json({ error: 'company_id é obrigatório' }, 400)
  if (!body.name?.trim()) return c.json({ error: 'name é obrigatório' }, 400)

  const member = await ensureCompanyMember(db, userId, body.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { data, error } = await db.from('contacts').insert({
    company_id: body.company_id,
    name: body.name.trim(),
    cpf: body.cpf?.trim() || null,
    cnpj: body.cnpj?.trim() || null,
  }).select().single()

  if (error) return c.json({ error: error.message }, 400)
  return c.json(data, 201)
})

router.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const id = c.req.param('id')
  const body = await c.req.json<{ name?: string; cpf?: string | null; cnpj?: string | null }>()

  const { data: contact } = await db.from('contacts').select('company_id').eq('id', id).maybeSingle()
  if (!contact) return c.json({ error: 'not found' }, 404)

  const member = await ensureCompanyMember(db, userId, contact.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) patch.name = body.name.trim()
  if ('cpf' in body) patch.cpf = body.cpf?.trim() || null
  if ('cnpj' in body) patch.cnpj = body.cnpj?.trim() || null

  const { data, error } = await db.from('contacts').update(patch).eq('id', id).select().single()
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})

router.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const id = c.req.param('id')

  const { data: contact } = await db.from('contacts').select('company_id').eq('id', id).maybeSingle()
  if (!contact) return c.json({ error: 'not found' }, 404)

  const member = await ensureCompanyMember(db, userId, contact.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { error } = await db.from('contacts').delete().eq('id', id)
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ ok: true })
})

export default router
