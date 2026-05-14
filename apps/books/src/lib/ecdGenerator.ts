import type { AccountPlan, JournalEntry } from '@/types'

export interface EcdCompany {
  name: string
  cnpj: string
}

interface PlanNode extends AccountPlan {
  level: number
  parentCode: string
}

// ── Formatters ────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}${m}${y}`
}

function fmtAmt(v: number): string {
  return Math.abs(v).toFixed(2).replace('.', ',')
}

function rec(...fields: (string | number)[]): string {
  return '|' + fields.join('|') + '|'
}

// ── Build sorted account list with hierarchy metadata ─────────

function buildPlans(plans: AccountPlan[]): PlanNode[] {
  const byId = new Map<string, PlanNode>()
  for (const p of plans) {
    byId.set(p.id, { ...p, level: 0, parentCode: '' })
  }

  for (const node of byId.values()) {
    if (node.parent_id) {
      const parent = byId.get(node.parent_id)
      if (parent) node.parentCode = parent.code
    }
  }

  const levelCache = new Map<string, number>()
  const getLevel = (id: string): number => {
    if (levelCache.has(id)) return levelCache.get(id)!
    const node = byId.get(id)
    if (!node) return 0
    const lv = node.parent_id && byId.has(node.parent_id)
      ? 1 + getLevel(node.parent_id)
      : 1
    levelCache.set(id, lv)
    return lv
  }

  for (const node of byId.values()) {
    node.level = getLevel(node.id)
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.code.localeCompare(b.code, 'pt-BR', { numeric: true, sensitivity: 'base' })
  )
}

// ── Compute period closing balances ───────────────────────────

function computeBalances(
  entries: JournalEntry[],
  plans: PlanNode[],
): Map<string, number> {
  const raw = new Map<string, { d: number; c: number }>()
  for (const entry of entries) {
    for (const line of entry.journal_entry_lines ?? []) {
      const code = line.account_plans?.code
      if (!code) continue
      const cur = raw.get(code) ?? { d: 0, c: 0 }
      if (line.side === 'debit') cur.d += line.amount
      else cur.c += line.amount
      raw.set(code, cur)
    }
  }

  const balances = new Map<string, number>()

  for (const plan of plans) {
    if (!plan.is_analytic) continue
    const { d = 0, c = 0 } = raw.get(plan.code) ?? { d: 0, c: 0 }
    balances.set(plan.code, plan.nature === 'debit' ? d - c : c - d)
  }

  // Bubble up to synthetic accounts (deepest level first)
  for (const plan of [...plans].sort((a, b) => b.level - a.level)) {
    if (plan.is_analytic) continue
    const childSum = plans
      .filter(p => p.parent_id === plan.id)
      .reduce((sum, child) => sum + (balances.get(child.code) ?? 0), 0)
    balances.set(plan.code, childSum)
  }

  return balances
}

// ── ECD Generator ─────────────────────────────────────────────

export function generateEcd(
  company: EcdCompany,
  period: string,
  accountPlans: AccountPlan[],
  journalEntries: JournalEntry[],
): string {
  const [y, m] = period.split('-').map(Number)
  const dtIni = `01${String(m).padStart(2, '0')}${y}`
  const lastDay = new Date(y, m, 0).getDate()
  const dtFin = `${String(lastDay).padStart(2, '0')}${String(m).padStart(2, '0')}${y}`

  const cnpj = company.cnpj.replace(/\D/g, '').slice(0, 14)
  const nome = company.name.toUpperCase().slice(0, 100)

  const plans = buildPlans(accountPlans)
  const byCode = new Map(plans.map(p => [p.code, p]))
  const balances = computeBalances(journalEntries, plans)

  // ── Block 0 ──────────────────────────────────────────────────
  const b0: string[] = []
  b0.push(rec('0000', 'LECD', '0', dtIni, dtFin, nome, cnpj, '', '', '', '', '', 'G', ''))
  b0.push(rec('0001', '1'))
  b0.push(rec('0150', '001', '1', '', '', '105', '', '', cnpj, '', '', '', '', nome))
  b0.push(rec('0990', b0.length + 1))

  // ── Block I ──────────────────────────────────────────────────
  const bI: string[] = []
  bI.push(rec('I001', '1'))
  bI.push(rec('I010', 'DIARIO', '', dtIni, dtFin, 'S', '', '', '0', '', 'G', ''))

  for (const plan of plans) {
    bI.push(rec(
      'I050', dtIni, plan.code, plan.name,
      plan.level, plan.parentCode,
      plan.nature === 'debit' ? 'D' : 'C',
      plan.is_analytic ? 'A' : 'S',
    ))
  }

  for (const entry of journalEntries) {
    const lines = (entry.journal_entry_lines ?? []).filter(l => l.account_plans?.code)
    if (!lines.length) continue
    const totalD = lines
      .filter(l => l.side === 'debit')
      .reduce((s, l) => s + l.amount, 0)
    bI.push(rec('I100', fmtDate(entry.entry_date), fmtAmt(totalD), 'D', entry.description.slice(0, 60), ''))
    lines.forEach((l, idx) => {
      const plan = byCode.get(l.account_plans!.code)
      bI.push(rec(
        'I150', idx + 1, l.account_plans!.code, '',
        fmtDate(entry.entry_date), '',
        l.side === 'debit' ? 'D' : 'C',
        fmtAmt(l.amount),
        plan?.is_analytic ? 'A' : 'S',
        '', '', l.memo ?? '', '',
      ))
    })
  }

  bI.push(rec('I990', bI.length + 1))

  // ── Block J ──────────────────────────────────────────────────
  const bJ: string[] = []
  bJ.push(rec('J001', '1'))
  bJ.push(rec('J005', dtIni, dtFin, dtFin, 'BRL'))

  for (const plan of plans) {
    const bal = balances.get(plan.code) ?? 0
    const absBal = Math.abs(bal)
    const isNormalSide = bal >= 0
    const dc = plan.nature === 'debit' ? 'D' : 'C'
    const indDcFin = isNormalSide ? dc : (dc === 'D' ? 'C' : 'D')
    bJ.push(rec('J100', plan.code, plan.name, plan.level, plan.parentCode, '0,00', '', fmtAmt(absBal), indDcFin))
  }

  bJ.push(rec('J990', bJ.length + 1))

  // ── Block 9 ──────────────────────────────────────────────────
  const main = [...b0, ...bI, ...bJ]

  const regCounts = new Map<string, number>()
  const regOrder: string[] = []
  for (const line of main) {
    const reg = line.slice(1, line.indexOf('|', 1))
    if (!regCounts.has(reg)) regOrder.push(reg)
    regCounts.set(reg, (regCounts.get(reg) ?? 0) + 1)
  }

  // 4 distinct REG types in block 9: 9001, 9900, 9990, 9999
  const total9900Lines = regOrder.length + 4

  const b9: string[] = []
  b9.push(rec('9001', '1'))
  for (const reg of regOrder) {
    b9.push(rec('9900', reg, regCounts.get(reg)!))
  }
  b9.push(rec('9900', '9001', '1'))
  b9.push(rec('9900', '9900', total9900Lines))
  b9.push(rec('9900', '9990', '1'))
  b9.push(rec('9900', '9999', '1'))
  b9.push(rec('9990', b9.length + 1))
  b9.push(rec('9999', main.length + b9.length + 1))

  return [...main, ...b9].join('\r\n') + '\r\n'
}
