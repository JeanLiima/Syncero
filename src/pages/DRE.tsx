import { useState } from 'react'
import { Card, Select, Badge } from '@/components/ui'
import { useDRE } from '@/modules/dre/queries'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const MONTHS = [
  { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },   { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },    { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },   { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },{ value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro'},{ value: '12', label: 'Dezembro' },
]

const yearOptions = ((): { value: string; label: string }[] => {
  const y = new Date().getFullYear()
  return [y - 1, y, y + 1].map((v) => ({ value: String(v), label: String(v) }))
})()

export function Component() {
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const { data = [], isLoading } = useDRE(year, month)

  const incomeRows  = data.filter((r) => r.type === 'income')
  const expenseRows = data.filter((r) => r.type === 'expense')
  const totalIncome  = incomeRows.reduce((s, r) => s + r.total, 0)
  const totalExpense = expenseRows.reduce((s, r) => s + r.total, 0)
  const net = totalIncome - totalExpense

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">DRE</h1>
        <div className="flex gap-2">
          <Select
            options={MONTHS}
            value={String(month)}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-36"
          />
          <Select
            options={yearOptions}
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24"
          />
        </div>
      </div>

      <Card padding="sm">
        {isLoading ? (
          <p className="text-sm text-[var(--text-muted)] p-4 text-center">Carregando…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--bg-border)]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
                  Categoria
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Receitas */}
              <tr className="bg-[var(--bg-elevated)]">
                <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-[var(--success)] uppercase tracking-wide">
                  Receitas
                </td>
              </tr>
              {incomeRows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-[var(--text-muted)] italic text-xs">
                    Sem receitas no período
                  </td>
                </tr>
              ) : incomeRows.map((r) => (
                <tr key={r.category_id ?? r.category_name} className="border-b border-[var(--bg-border)]">
                  <td className="px-4 py-3 text-[var(--text-primary)]">{r.category_name}</td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--success)]">{fmt(r.total)}</td>
                </tr>
              ))}
              <tr className="border-b-2 border-[var(--bg-border)]">
                <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">Total Receitas</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--success)]">{fmt(totalIncome)}</td>
              </tr>

              {/* Despesas */}
              <tr className="bg-[var(--bg-elevated)]">
                <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-[var(--danger)] uppercase tracking-wide">
                  Despesas
                </td>
              </tr>
              {expenseRows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-[var(--text-muted)] italic text-xs">
                    Sem despesas no período
                  </td>
                </tr>
              ) : expenseRows.map((r) => (
                <tr key={r.category_id ?? r.category_name} className="border-b border-[var(--bg-border)]">
                  <td className="px-4 py-3 text-[var(--text-primary)]">{r.category_name}</td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--danger)]">{fmt(r.total)}</td>
                </tr>
              ))}
              <tr className="border-b-2 border-[var(--bg-border)]">
                <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">Total Despesas</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--danger)]">{fmt(totalExpense)}</td>
              </tr>

              {/* Resultado */}
              <tr className="bg-[var(--bg-elevated)]">
                <td className="px-4 py-4 font-bold text-[var(--text-primary)] text-base">Resultado Líquido</td>
                <td className={`px-4 py-4 text-right font-mono font-bold text-base ${net >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                  {fmt(net)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>

      {/* Net badge */}
      {!isLoading && (
        <div className="flex justify-end">
          <Badge variant={net >= 0 ? 'success' : 'danger'} className="text-sm px-3 py-1">
            {net >= 0 ? 'Lucro' : 'Prejuízo'}: {fmt(Math.abs(net))}
          </Badge>
        </div>
      )}
    </div>
  )
}
