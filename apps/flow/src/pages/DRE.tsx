import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'
import { Card, Select, Badge } from '@syncero/ui'
import { useDRE } from '@/modules/dre/queries'
import { useT } from '@/i18n'
import { usePreferencesStore } from '@/store/preferences'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const yearOptions = ((): { value: string; label: string }[] => {
  const y = new Date().getFullYear()
  return [y - 1, y, y + 1].map((v) => ({ value: String(v), label: String(v) }))
})()

export function Component() {
  const t = useT()
  const { language } = usePreferencesStore()
  const locale = language === 'pt' ? ptBR : enUS
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const { data = [], isLoading } = useDRE(year, month)

  // Generate month options from date-fns locale
  const MONTHS = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: format(new Date(2023, i, 1), 'MMMM', { locale }),
  }))

  const incomeRows  = data.filter((r) => r.type === 'income')
  const expenseRows = data.filter((r) => r.type === 'expense')
  const totalIncome  = incomeRows.reduce((s, r) => s + r.total, 0)
  const totalExpense = expenseRows.reduce((s, r) => s + r.total, 0)
  const net = totalIncome - totalExpense

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('dre_title')}</h1>
        <div className="flex gap-2">
          <Select
            options={MONTHS}
            value={String(month)}
            onChange={(v) => setMonth(Number(v))}
            className="w-36"
          />
          <Select
            options={yearOptions}
            value={String(year)}
            onChange={(v) => setYear(Number(v))}
            className="w-24"
          />
        </div>
      </div>

      <Card padding="sm">
        {isLoading ? (
          <p className="text-sm text-[var(--text-muted)] p-4 text-center">{t('dre_loading')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--bg-border)]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
                  {t('dre_category')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
                  {t('dre_result')}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Receitas */}
              <tr className="bg-[var(--bg-elevated)]">
                <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-[var(--success)] uppercase tracking-wide">
                  {t('dre_income')}
                </td>
              </tr>
              {incomeRows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-[var(--text-muted)] italic text-xs">
                    {t('dre_noIncome')}
                  </td>
                </tr>
              ) : incomeRows.map((r) => (
                <tr key={r.category_id ?? r.category_name} className="border-b border-[var(--bg-border)]">
                  <td className="px-4 py-3 text-[var(--text-primary)]">{r.category_name}</td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--success)]">{fmt(r.total)}</td>
                </tr>
              ))}
              <tr className="border-b-2 border-[var(--bg-border)]">
                <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{t('dre_totalIncome')}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--success)]">{fmt(totalIncome)}</td>
              </tr>

              {/* Despesas */}
              <tr className="bg-[var(--bg-elevated)]">
                <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-[var(--danger)] uppercase tracking-wide">
                  {t('dre_expense')}
                </td>
              </tr>
              {expenseRows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-[var(--text-muted)] italic text-xs">
                    {t('dre_noExpense')}
                  </td>
                </tr>
              ) : expenseRows.map((r) => (
                <tr key={r.category_id ?? r.category_name} className="border-b border-[var(--bg-border)]">
                  <td className="px-4 py-3 text-[var(--text-primary)]">{r.category_name}</td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--danger)]">{fmt(r.total)}</td>
                </tr>
              ))}
              <tr className="border-b-2 border-[var(--bg-border)]">
                <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{t('dre_totalExpense')}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--danger)]">{fmt(totalExpense)}</td>
              </tr>

              {/* Resultado */}
              <tr className="bg-[var(--bg-elevated)]">
                <td className="px-4 py-4 font-bold text-[var(--text-primary)] text-base">{t('dre_netResult')}</td>
                <td className={`px-4 py-4 text-right font-mono font-bold text-base ${net >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                  {fmt(net)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>

      {!isLoading && (
        <div className="flex justify-end">
          <Badge variant={net >= 0 ? 'success' : 'danger'} className="text-sm px-3 py-1">
            {net >= 0 ? t('dre_profit') : t('dre_loss')}: {fmt(Math.abs(net))}
          </Badge>
        </div>
      )}
    </div>
  )
}
