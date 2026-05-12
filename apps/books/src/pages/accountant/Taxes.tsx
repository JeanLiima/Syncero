import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckCircle2, ClipboardCheck, Info, RefreshCw, RotateCcw } from 'lucide-react'
import { Badge, Button, Card, Modal, MonthPicker, useToast } from '@syncero/ui'
import { getTaxCalculations, calculateTaxes, updateTaxStatus } from '@/lib/backend'
import { apiFetch } from '@/lib/api'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { useT } from '@/i18n'
import { usePreferencesStore } from '@/store/preferences'
import type { TaxCalculation } from '@/types'

// ── helpers ───────────────────────────────────────────────────

const statusVariant = (s: TaxCalculation['status']): 'success' | 'info' | 'warning' => {
  if (s === 'paid')       return 'success'
  if (s === 'calculated') return 'info'
  return 'warning'
}

type InfoKey = 'impostos_infoSimples' | 'impostos_infoPresumido' | 'impostos_infoReal'
const regimeInfo: Record<string, InfoKey> = {
  simples:         'impostos_infoSimples',
  lucro_presumido: 'impostos_infoPresumido',
  lucro_real:      'impostos_infoReal',
}

// ── Revenue-12m modal (Simples only) ─────────────────────────

function Revenue12mModal({
  open, onConfirm, onCancel, loading,
}: { open: boolean; onConfirm: (v: number) => void; onCancel: () => void; loading: boolean }) {
  const t = useT()
  const [cents, setCents] = useState(0)

  const display = (() => {
    const p = String(cents).padStart(3, '0')
    return p.slice(0, -2) + ',' + p.slice(-2)
  })()

  return (
    <Modal
      open={open} onClose={onCancel}
      title={t('impostos_revenue12m_title')} size="sm"
      footer={
        <div className="flex justify-between">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>{t('impostos_revenue12m_cancel')}</Button>
          <Button size="sm" onClick={() => onConfirm(cents / 100)} loading={loading} disabled={cents === 0}>
            {t('impostos_revenue12m_confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--text-muted)]">{t('impostos_revenue12m_desc')}</p>
        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1.5">
            {t('impostos_revenue12m_label')}
          </label>
          <div className="flex items-center gap-1.5 h-11 px-3 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border border-[var(--bg-border)] focus-within:border-[var(--accent)] transition-colors">
            <span className="text-sm text-[var(--text-muted)] shrink-0">R$</span>
            <input
              type="text" inputMode="numeric" value={display}
              onChange={() => {}}
              onKeyDown={e => {
                if (e.key >= '0' && e.key <= '9') {
                  e.preventDefault()
                  setCents(c => Math.min(c * 10 + parseInt(e.key), 9_999_999_99))
                } else if (e.key === 'Backspace') {
                  e.preventDefault()
                  setCents(c => Math.floor(c / 10))
                }
              }}
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] text-right outline-none font-mono min-w-0"
              autoFocus
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────

export function Component() {
  const t = useT()
  const { id, isExternal } = useCompanyContext()
  const language = usePreferencesStore(s => s.language)
  const qc = useQueryClient()
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast()

  const [period, setPeriod]           = useState(() => new Date().toISOString().slice(0, 7))
  const [revenue12mOpen, set12mOpen]  = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [updatingId, setUpdatingId]   = useState<string | null>(null)

  const periodLabel = (() => {
    const raw = format(parseISO(`${period}-01`), 'MMMM yyyy', { locale: ptBR })
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  })()

  // Company info — linked or external
  const { data: company } = useQuery({
    queryKey: isExternal ? ['external-company', id] : ['company-readonly', id],
    queryFn: () => isExternal
      ? apiFetch<{ tax_regime: string | null }>(`/api/external-companies/${id}`)
      : apiFetch<{ tax_regime: string | null }>(`/api/companies/${id}`),
    enabled: !!id,
  })

  const qKey = ['tax-calculations', id]
  const { data: allCalcs = [], isLoading } = useQuery({
    queryKey: qKey,
    queryFn: () => getTaxCalculations(isExternal ? { extCompanyId: id } : { companyId: id }),
    enabled: !!id,
  })

  const grouped = allCalcs.reduce<Record<string, TaxCalculation[]>>((acc, c) => {
    (acc[c.period] ??= []).push(c)
    return acc
  }, {})

  const taxRegime = company?.tax_regime ?? null
  const isSimples = taxRegime === 'simples'
  const hasCurrent = !!grouped[period]

  const runCalculate = async (revenue12m?: number) => {
    setCalculating(true); set12mOpen(false)
    try {
      await calculateTaxes({
        ...(isExternal ? { extCompanyId: id } : { companyId: id }),
        period, revenue12m,
      })
      qc.invalidateQueries({ queryKey: qKey })
      qc.invalidateQueries({ queryKey: ['fiscal-summary', id] })
      toastSuccess(`Apuração de ${periodLabel} concluída.`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'no_journal_data')   toastWarning(t('impostos_noJournalData'))
      else if (msg === 'no_segment')   toastError(t('impostos_noSegment'))
      else if (msg === 'no_tax_regime')toastError(t('impostos_noRegime'))
      else toastError(msg || 'Erro ao apurar.')
    } finally {
      setCalculating(false)
    }
  }

  const handleCalculate = () => {
    if (!taxRegime)  { toastError(t('impostos_noRegime')); return }
    if (isSimples)   { set12mOpen(true); return }
    runCalculate()
  }

  const handleStatus = async (calc: TaxCalculation, next: TaxCalculation['status']) => {
    setUpdatingId(calc.id)
    try {
      const paid = next === 'paid' ? new Date().toISOString().slice(0, 10) : undefined
      await updateTaxStatus(calc.id, next, paid)
      qc.invalidateQueries({ queryKey: qKey })
      qc.invalidateQueries({ queryKey: ['fiscal-summary', id] })
    } catch {
      toastError('Erro ao atualizar status.')
    } finally {
      setUpdatingId(null)
    }
  }

  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const infoKey = taxRegime ? regimeInfo[taxRegime] : null

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('impostos_title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <MonthPicker value={period} onChange={setPeriod} language={language} size="sm" />
          <Button size="sm" onClick={handleCalculate} loading={calculating} variant={hasCurrent ? 'ghost' : undefined}>
            {hasCurrent
              ? <><RefreshCw className="h-4 w-4" />{t('impostos_recalculate')}</>
              : t('impostos_calculate')
            }
          </Button>
        </div>
      </div>

      {/* Regime info */}
      {infoKey && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-4 py-3">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-[var(--text-muted)]" />
          <p className="text-xs text-[var(--text-muted)]">{t(infoKey)}</p>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <Card><p className="text-sm text-[var(--text-muted)] text-center py-6">Carregando…</p></Card>
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--text-muted)] text-center py-8">{t('impostos_empty')}</p>
        </Card>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([p, rows]) => {
            const total  = rows.reduce((s, r) => s + r.tax_amount, 0)
            const calcAt = rows[0]?.calculated_at
            const pLabel = (() => {
              const raw = format(parseISO(`${p}-01`), 'MMMM yyyy', { locale: ptBR })
              return raw.charAt(0).toUpperCase() + raw.slice(1)
            })()

            return (
              <Card key={p} className="p-0 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--bg-border)] bg-[var(--bg-elevated)]">
                  <div>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{pLabel}</span>
                    {calcAt && (
                      <span className="text-xs text-[var(--text-muted)] ml-2">
                        · {t('impostos_calculatedAt')} {format(new Date(calcAt), 'dd/MM/yyyy HH:mm')}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-sm font-semibold text-[var(--danger)]">
                    {t('impostos_total')} {fmt(total)}
                  </span>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--bg-border)]/50">
                      <th className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] text-left w-20">{t('impostos_tax')}</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] text-right">{t('impostos_base')}</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] text-right w-20">{t('impostos_rate')}</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] text-right w-32">{t('impostos_value')}</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] text-right w-28">{t('impostos_dueDate')}</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] w-24">{t('impostos_status')}</th>
                      <th className="px-4 py-2.5 w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const busy = updatingId === r.id
                      return (
                        <tr key={r.id} className="border-b border-[var(--bg-border)]/40 hover:bg-[var(--bg-elevated)]/50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-[var(--text-primary)] font-mono text-sm">{r.tax_type}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-[var(--text-secondary)]">{fmt(r.base_amount)}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-[var(--text-muted)]">
                            {(r.rate * 100).toFixed(2).replace('.', ',')}%
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium text-[var(--danger)]">{fmt(r.tax_amount)}</td>
                          <td className="px-4 py-3 text-right text-xs text-[var(--text-muted)]">
                            {r.due_date ? format(new Date(r.due_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusVariant(r.status)} className="text-xs">
                              {t(`impostos_${r.status}` as Parameters<typeof t>[0])}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-0.5">
                              {r.status !== 'paid' && (
                                <button
                                  onClick={() => handleStatus(r, 'paid')}
                                  disabled={busy}
                                  title={t('impostos_markPaid')}
                                  className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--success)] transition-colors disabled:opacity-40"
                                >
                                  {busy ? <span className="text-xs">…</span> : <CheckCircle2 className="h-4 w-4" />}
                                </button>
                              )}
                              {r.status === 'draft' && (
                                <button
                                  onClick={() => handleStatus(r, 'calculated')}
                                  disabled={busy}
                                  title={t('impostos_markCalculated')}
                                  className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--accent)] transition-colors disabled:opacity-40"
                                >
                                  <ClipboardCheck className="h-4 w-4" />
                                </button>
                              )}
                              {r.status === 'paid' && (
                                <button
                                  onClick={() => handleStatus(r, 'draft')}
                                  disabled={busy}
                                  title={t('impostos_markDraft')}
                                  className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] transition-colors disabled:opacity-40"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
            )
          })
      )}

      <Revenue12mModal
        open={revenue12mOpen}
        onConfirm={v => runCalculate(v)}
        onCancel={() => set12mOpen(false)}
        loading={calculating}
      />
    </div>
  )
}
