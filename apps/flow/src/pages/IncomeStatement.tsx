import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, MonthPicker, Badge, Skeleton, Modal } from '@syncero/ui'
import { useIncomeStatement } from '@/modules/incomeStatement/queries'
import { useT } from '@/i18n'
import { usePreferencesStore } from '@/store/preferences'
import { useAuthStore } from '@/store/auth'
import { getTransactions } from '@/lib/backend'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type DrillTarget = { categoryId: string | null; categoryName: string; type: 'income' | 'expense' }

function useDrillTransactions(target: DrillTarget | null, year: number, month: number) {
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useQuery({
    queryKey: ['dre-drill', activeCompany?.id, target?.categoryId, year, month],
    queryFn: async () => {
      if (!activeCompany?.id || !target) return []
      const date = new Date(year, month - 1, 1)
      const result = await getTransactions({
        companyId: activeCompany.id,
        type: target.type,
        category_id: target.categoryId ?? undefined,
        date_from: format(startOfMonth(date), 'yyyy-MM-dd'),
        date_to: format(endOfMonth(date), 'yyyy-MM-dd'),
        page: '1',
        pageSize: '200',
      })
      return result.data ?? []
    },
    enabled: !!activeCompany?.id && !!target,
  })
}

function DrillDownModal({
  target,
  year,
  month,
  onClose,
}: {
  target: DrillTarget | null
  year: number
  month: number
  onClose: () => void
}) {
  const t = useT()
  const { data: rows = [], isLoading } = useDrillTransactions(target, year, month)

  const title = target
    ? `${target.categoryName} — ${format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: ptBR })}`
    : ''

  return (
    <Modal open={!!target} onClose={onClose} title={`${t('incomeStatement_drillDownTitle')}: ${title}`} size="lg">
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] text-center py-6">{t('incomeStatement_drillDownEmpty')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--bg-border)]">
              <th className="py-2 text-left text-xs font-medium text-[var(--text-muted)]">Data</th>
              <th className="py-2 text-left text-xs font-medium text-[var(--text-muted)]">Descrição</th>
              <th className="py-2 text-right text-xs font-medium text-[var(--text-muted)]">Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => (
              <tr key={tx.id} className="border-b border-[var(--bg-border)]">
                <td className="py-2.5 text-[var(--text-muted)] whitespace-nowrap pr-4">
                  {format(new Date(tx.date + 'T00:00:00'), 'dd/MM/yyyy')}
                </td>
                <td className="py-2.5 text-[var(--text-primary)]">{tx.description}</td>
                <td className={`py-2.5 text-right font-mono font-medium ${target?.type === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                  {fmt(tx.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="pt-3 font-semibold text-[var(--text-primary)]">Total</td>
              <td className={`pt-3 text-right font-mono font-semibold ${target?.type === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                {fmt(rows.reduce((s, r) => s + r.amount, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </Modal>
  )
}

export function Component() {
  const t = useT()
  const { language } = usePreferencesStore()
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7))
  const [drill, setDrill] = useState<DrillTarget | null>(null)

  const year  = Number(period.slice(0, 4))
  const month = Number(period.slice(5, 7))

  const { data = [], isLoading } = useIncomeStatement(year, month)

  const incomeRows  = data.filter((r) => r.type === 'income')
  const expenseRows = data.filter((r) => r.type === 'expense')
  const totalIncome  = incomeRows.reduce((s, r) => s + r.total, 0)
  const totalExpense = expenseRows.reduce((s, r) => s + r.total, 0)
  const net = totalIncome - totalExpense

  const openDrill = (categoryId: string | null, categoryName: string, type: 'income' | 'expense') =>
    setDrill({ categoryId, categoryName, type })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('incomeStatement_title')}</h1>
        <MonthPicker
          value={period}
          onChange={setPeriod}
          language={language}
          size="sm"
        />
      </div>

      <Card padding="sm">
        {isLoading ? (
          <table className="w-full text-sm">
            <tbody>
              <tr className="bg-[var(--bg-elevated)]">
                <td colSpan={2} className="px-4 py-2"><Skeleton className="h-3 w-20" /></td>
              </tr>
              {Array.from({ length: 3 }).map((_, i) => (
                <tr key={`inc-${i}`} className="border-b border-[var(--bg-border)]">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                  <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-24 ml-auto" /></td>
                </tr>
              ))}
              <tr className="border-b-2 border-[var(--bg-border)]">
                <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-24 ml-auto" /></td>
              </tr>
              <tr className="bg-[var(--bg-elevated)]">
                <td colSpan={2} className="px-4 py-2"><Skeleton className="h-3 w-20" /></td>
              </tr>
              {Array.from({ length: 3 }).map((_, i) => (
                <tr key={`exp-${i}`} className="border-b border-[var(--bg-border)]">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                  <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-24 ml-auto" /></td>
                </tr>
              ))}
              <tr className="border-b-2 border-[var(--bg-border)]">
                <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-24 ml-auto" /></td>
              </tr>
              <tr className="bg-[var(--bg-elevated)]">
                <td className="px-4 py-4"><Skeleton className="h-5 w-28" /></td>
                <td className="px-4 py-4 text-right"><Skeleton className="h-5 w-28 ml-auto" /></td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--bg-border)]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] capitalize tracking-wide">
                  {t('incomeStatement_category')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] capitalize tracking-wide">
                  {t('incomeStatement_result')}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Receitas */}
              <tr className="bg-[var(--bg-elevated)]">
                <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-[var(--success)] uppercase tracking-wide">
                  {t('incomeStatement_income')}
                </td>
              </tr>
              {incomeRows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-[var(--text-muted)] italic text-xs">
                    {t('incomeStatement_noIncome')}
                  </td>
                </tr>
              ) : incomeRows.map((r) => (
                <tr
                  key={r.category_id ?? '__none_income'}
                  className="border-b border-[var(--bg-border)] hover:bg-[var(--bg-elevated)] cursor-pointer transition-colors"
                  onClick={() => openDrill(r.category_id, r.category_id === null ? t('incomeStatement_drillDownNoCategory') : r.category_name, 'income')}
                >
                  <td className="px-4 py-3 text-[var(--text-primary)]">
                    {r.category_id === null ? t('transactions_noCategory') : r.category_name}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--success)]">{fmt(r.total)}</td>
                </tr>
              ))}
              <tr className="border-b-2 border-[var(--bg-border)]">
                <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{t('incomeStatement_totalIncome')}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--success)]">{fmt(totalIncome)}</td>
              </tr>

              {/* Despesas */}
              <tr className="bg-[var(--bg-elevated)]">
                <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-[var(--danger)] uppercase tracking-wide">
                  {t('incomeStatement_expense')}
                </td>
              </tr>
              {expenseRows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-[var(--text-muted)] italic text-xs">
                    {t('incomeStatement_noExpense')}
                  </td>
                </tr>
              ) : expenseRows.map((r) => (
                <tr
                  key={r.category_id ?? '__none_expense'}
                  className="border-b border-[var(--bg-border)] hover:bg-[var(--bg-elevated)] cursor-pointer transition-colors"
                  onClick={() => openDrill(r.category_id, r.category_id === null ? t('incomeStatement_drillDownNoCategory') : r.category_name, 'expense')}
                >
                  <td className="px-4 py-3 text-[var(--text-primary)]">
                    {r.category_id === null ? t('transactions_noCategory') : r.category_name}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--danger)]">{fmt(r.total)}</td>
                </tr>
              ))}
              <tr className="border-b-2 border-[var(--bg-border)]">
                <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{t('incomeStatement_totalExpense')}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--danger)]">{fmt(totalExpense)}</td>
              </tr>

              {/* Resultado */}
              <tr className="bg-[var(--bg-elevated)]">
                <td className="px-4 py-4 font-bold text-[var(--text-primary)] text-base">{t('incomeStatement_netResult')}</td>
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
            {net >= 0 ? t('incomeStatement_profit') : t('incomeStatement_loss')}: {fmt(Math.abs(net))}
          </Badge>
        </div>
      )}

      <DrillDownModal
        target={drill}
        year={year}
        month={month}
        onClose={() => setDrill(null)}
      />
    </div>
  )
}
