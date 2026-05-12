import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

// ── helpers ───────────────────────────────────────────────────

type DB = ReturnType<typeof createServiceClient>

async function ensureAccessLinked(db: DB, userId: string, companyId: string) {
  const { data } = await db.from('accountant_companies')
    .select('id, iss_rate, segment')
    .eq('accountant_id', userId).eq('company_id', companyId).eq('status', 'accepted')
    .maybeSingle()
  return data
}

async function ensureAccessExternal(db: DB, userId: string, extCompanyId: string) {
  const { data } = await db.from('external_companies')
    .select('id, tax_regime, segment, iss_rate')
    .eq('id', extCompanyId).eq('accountant_id', userId)
    .maybeSingle()
  return data
}

function lastDay(period: string) {
  const [y, m] = period.split('-').map(Number)
  return `${period}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}

function dueDate(period: string, day: number) {
  const [y, m] = period.split('-').map(Number)
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  return `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Simples rate tables
const SIMPLES_I = [ // Comércio / Indústria
  { max: 180000,  rate: 0.04,  ded: 0 },
  { max: 360000,  rate: 0.073, ded: 5940 },
  { max: 720000,  rate: 0.095, ded: 13860 },
  { max: 1800000, rate: 0.107, ded: 22500 },
  { max: 3600000, rate: 0.143, ded: 87300 },
  { max: 4800000, rate: 0.19,  ded: 378000 },
]
const SIMPLES_III = [ // Serviços (default)
  { max: 180000,  rate: 0.06,  ded: 0 },
  { max: 360000,  rate: 0.112, ded: 9360 },
  { max: 720000,  rate: 0.132, ded: 17640 },
  { max: 1800000, rate: 0.16,  ded: 35640 },
  { max: 3600000, rate: 0.21,  ded: 125640 },
  { max: 4800000, rate: 0.33,  ded: 648000 },
]

const COMMERCE_SEGMENTS = new Set([
  'retail','manufacturing','agribusiness','construction',
  'comercio','industria','agronegocio','construcao_civil', // legacy PT values
])

function simplisRate(rev12m: number, segment: string | null): number {
  const table = COMMERCE_SEGMENTS.has(segment ?? '') ? SIMPLES_I : SIMPLES_III
  const b = table.find(r => rev12m <= r.max) ?? table[table.length - 1]
  return rev12m > 0
    ? Math.round(((rev12m * b.rate) - b.ded) / rev12m * 100000) / 100000
    : b.rate
}

function presumpRate(segment: string | null): number {
  return COMMERCE_SEGMENTS.has(segment ?? '') ? 0.08 : 0.32
}

async function aggregate(db: DB, filter: Record<string, string>, dateFrom: string, dateTo: string) {
  const col = Object.keys(filter)[0]
  const val = Object.values(filter)[0]
  const { data } = await db
    .from('journal_entries')
    .select('journal_entry_lines(side, amount, account_plans(account_type))')
    .eq(col, val)
    .gte('entry_date', dateFrom)
    .lte('entry_date', dateTo)

  let revenue = 0, expenses = 0
  for (const e of data ?? []) {
    for (const l of (e as any).journal_entry_lines ?? []) {
      const t = l.account_plans?.account_type
      const a = Number(l.amount)
      if (t === 'revenue' && l.side === 'credit') revenue  += a
      if ((t === 'expense' || t === 'cost') && l.side === 'debit') expenses += a
    }
  }
  return { revenue, expenses }
}

const r2 = (n: number) => Math.round(n * 100) / 100

// ── GET /api/tax-calculations ─────────────────────────────────
router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { company_id, ext_company_id } = c.req.query()
  if (!company_id && !ext_company_id) return c.json({ error: 'company_id or ext_company_id required' }, 400)

  if (company_id) {
    if (!await ensureAccessLinked(db, userId, company_id)) return c.json({ error: 'forbidden' }, 403)
  } else {
    if (!await ensureAccessExternal(db, userId, ext_company_id!)) return c.json({ error: 'forbidden' }, 403)
  }

  let q = db.from('tax_calculations').select('*').order('period', { ascending: false }).order('tax_type')
  if (company_id)     q = q.eq('company_id', company_id)
  else                q = q.eq('ext_company_id', ext_company_id!)

  const { data, error } = await q
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data ?? [])
})

// ── POST /api/tax-calculations/calculate ─────────────────────
router.post('/calculate', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<{
    company_id?: string; ext_company_id?: string
    period: string; revenue_12m?: number
  }>()

  const { company_id, ext_company_id, period, revenue_12m } = body
  if (!company_id && !ext_company_id) return c.json({ error: 'company_id or ext_company_id required' }, 400)
  if (!period) return c.json({ error: 'period required' }, 400)

  let taxRegime: string | null = null
  let segment: string | null   = null
  let issRate  = 0
  const colFilter: Record<string, string> = {}

  if (company_id) {
    const link = await ensureAccessLinked(db, userId, company_id)
    if (!link) return c.json({ error: 'forbidden' }, 403)
    const { data: co } = await db.from('companies').select('tax_regime, segment').eq('id', company_id).maybeSingle()
    if (!co) return c.json({ error: 'company not found' }, 404)
    taxRegime = co.tax_regime
    segment   = (co as any).segment   // segment comes from Flow
    issRate   = Number(link.iss_rate ?? 0)
    colFilter['company_id'] = company_id
  } else {
    const ext = await ensureAccessExternal(db, userId, ext_company_id!)
    if (!ext) return c.json({ error: 'forbidden' }, 403)
    taxRegime = ext.tax_regime
    segment   = ext.segment
    issRate   = Number(ext.iss_rate ?? 0)
    colFilter['ext_company_id'] = ext_company_id!
  }

  if (!taxRegime) return c.json({ error: 'no_tax_regime' }, 422)
  if (!segment)   return c.json({ error: 'no_segment' }, 422)
  if (taxRegime === 'simples' && !revenue_12m) return c.json({ error: 'revenue_12m_required' }, 422)

  const dateFrom = `${period}-01`
  const dateTo   = lastDay(period)
  const month    = parseInt(period.split('-')[1])
  const { revenue, expenses } = await aggregate(db, colFilter, dateFrom, dateTo)

  if (revenue === 0 && expenses === 0) return c.json({ error: 'no_journal_data' }, 422)

  const now = new Date().toISOString()
  type TaxRow = Record<string, unknown>
  const taxes: TaxRow[] = []

  const push = (type: string, base: number, rate: number, amount: number, due: string | null, notes?: string) =>
    taxes.push({
      ...(company_id ? { company_id } : { ext_company_id }),
      period, tax_type: type,
      base_amount: r2(base), rate, tax_amount: r2(amount),
      status: 'draft', due_date: due, notes: notes ?? null,
      accountant_id: userId, calculated_at: now,
    })

  if (taxRegime === 'simples') {
    const eff = simplisRate(revenue_12m!, segment)
    const anexo = COMMERCE_SEGMENTS.has(segment ?? '') ? 'I' : 'III'
    push('DAS', revenue, eff, revenue * eff, dueDate(period, 20),
      `Simples Anexo ${anexo} · RBT12: ${revenue_12m!.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`)
  }

  if (taxRegime === 'lucro_presumido') {
    push('PIS',    revenue, 0.0065, revenue * 0.0065, dueDate(period, 25))
    push('COFINS', revenue, 0.03,   revenue * 0.03,   dueDate(period, 25))
    if (issRate > 0) push('ISS', revenue, issRate, revenue * issRate, dueDate(period, 10))

    if ([3, 6, 9, 12].includes(month)) {
      const qYear  = parseInt(period.split('-')[0])
      const qStart = `${qYear}-${String(month - 2).padStart(2, '0')}-01`
      const { revenue: qRev } = await aggregate(db, colFilter, qStart, dateTo)
      const pres = presumpRate(segment)
      const irpjBase = r2(qRev * pres)
      push('IRPJ', irpjBase, 0.15, r2(irpjBase * 0.15) + r2(Math.max(0, irpjBase - 60000) * 0.10),
        dueDate(period, 20), `Presunção ${(pres * 100).toFixed(0)}% · ${qStart.slice(0,7)} a ${period}`)
      const csllBase = r2(qRev * pres)
      push('CSLL', csllBase, 0.09, r2(csllBase * 0.09),
        dueDate(period, 20), `Presunção ${(pres * 100).toFixed(0)}%`)
    }
  }

  if (taxRegime === 'lucro_real') {
    push('PIS',    revenue, 0.0165, revenue * 0.0165, dueDate(period, 25))
    push('COFINS', revenue, 0.076,  revenue * 0.076,  dueDate(period, 25))
    if (issRate > 0) push('ISS', revenue, issRate, revenue * issRate, dueDate(period, 10))
    const profit = Math.max(0, revenue - expenses)
    if (profit > 0) {
      push('IRPJ', profit, 0.15, r2(profit * 0.15) + r2(Math.max(0, profit - 20000) * 0.10), dueDate(period, 20))
      push('CSLL', profit, 0.09, r2(profit * 0.09), dueDate(period, 20))
    }
  }

  await db.from('tax_calculations').delete()
    .eq(Object.keys(colFilter)[0], Object.values(colFilter)[0])
    .eq('period', period)

  const { data: inserted, error } = await db.from('tax_calculations').insert(taxes).select('*')
  if (error) return c.json({ error: error.message }, 500)
  return c.json(inserted, 201)
})

// ── PATCH /api/tax-calculations/:id ──────────────────────────
router.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: existing } = await db.from('tax_calculations')
    .select('company_id, ext_company_id').eq('id', id).maybeSingle()
  if (!existing) return c.json({ error: 'not found' }, 404)

  if (existing.company_id) {
    if (!await ensureAccessLinked(db, userId, existing.company_id)) return c.json({ error: 'forbidden' }, 403)
  } else {
    if (!await ensureAccessExternal(db, userId, existing.ext_company_id!)) return c.json({ error: 'forbidden' }, 403)
  }

  const body = await c.req.json<{ status?: string; paid_date?: string | null; notes?: string | null }>()
  const updates: Record<string, unknown> = {}
  if (body.status    !== undefined) updates.status    = body.status
  if (body.notes     !== undefined) updates.notes     = body.notes
  if (body.paid_date !== undefined) updates.paid_date = body.paid_date
  if (body.status === 'paid' && !body.paid_date) updates.paid_date = new Date().toISOString().slice(0, 10)

  const { data, error } = await db.from('tax_calculations').update(updates).eq('id', id).select('*').single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

export default router
