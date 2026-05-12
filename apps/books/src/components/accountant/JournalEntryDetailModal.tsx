import { Badge, Modal } from '@syncero/ui'
import { useT } from '@/i18n'
import type { EntrySource, JournalEntry } from '@/types'

const sourceVariant: Record<EntrySource, 'default' | 'info' | 'success' | 'warning'> = {
  manual: 'default',
  api: 'success',
  syncero_import: 'warning',
}

interface Props {
  entry: JournalEntry | null
  open: boolean
  onClose: () => void
  sourceLabel: Record<string, string>
}

export function JournalEntryDetailModal({ entry, open, onClose, sourceLabel }: Props) {
  const t = useT()

  const lines = entry?.journal_entry_lines ?? []
  const debits  = lines.filter(l => l.side === 'debit')
  const credits = lines.filter(l => l.side === 'credit')
  const totalDebit  = debits.reduce((s, l) => s + Number(l.amount), 0)
  const totalCredit = credits.reduce((s, l) => s + Number(l.amount), 0)

  const fmt = (n: number) => n > 0
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : ''

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('lancamentos_detail_title')}
      size="md"
      footer={
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="cursor-pointer px-4 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-border)] text-[var(--text-secondary)] transition-colors"
          >
            {t('lancamentos_detail_close')}
          </button>
        </div>
      }
    >
      {entry && (
        <div className="flex flex-col gap-5">

          {/* Header info */}
          <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[var(--text-primary)]">{entry.description}</span>
              <Badge variant={sourceVariant[entry.source]}>
                {sourceLabel[entry.source] ?? entry.source}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
              <span>{new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
              {entry.external_ref && (
                <span className="flex items-center gap-1">
                  <span className="text-[var(--text-muted)]">{t('lancamentos_detail_doc')}:</span>
                  <span className="font-mono text-[var(--text-secondary)]">{entry.external_ref}</span>
                </span>
              )}
            </div>
          </div>

          {/* Partidas (double-entry lines) */}
          {lines.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-4">{t('lancamentos_detail_noLines')}</p>
          ) : (
            <div className="rounded-xl border border-[var(--bg-border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--bg-border)] bg-[var(--bg-elevated)]">
                    <th className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] text-left">{t('lancamentos_detail_account')}</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-blue-400 text-right w-32">{t('lancamentos_detail_debit')}</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-green-400 text-right w-32">{t('lancamentos_detail_credit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-b border-[var(--bg-border)]/50 hover:bg-[var(--bg-elevated)]/50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-mono shrink-0 ${
                            l.side === 'debit'
                              ? 'bg-blue-500/15 text-blue-400'
                              : 'bg-green-500/15 text-green-400'
                          }`}>
                            {l.side === 'debit' ? 'D' : 'C'}
                          </span>
                          <div>
                            <span className="font-mono text-xs text-[var(--text-muted)]">
                              {l.account_plans?.code ?? '—'}
                            </span>
                            {' '}
                            <span className="text-xs text-[var(--text-primary)]">
                              {l.account_plans?.name ?? ''}
                            </span>
                            {l.memo && (
                              <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{l.memo}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-blue-400">
                        {l.side === 'debit' ? fmt(Number(l.amount)) : ''}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-green-400">
                        {l.side === 'credit' ? fmt(Number(l.amount)) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[var(--bg-border)] bg-[var(--bg-elevated)]">
                    <td className="px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)]">
                      {t('lancamentos_detail_total')}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold text-blue-400">
                      {fmt(totalDebit)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold text-green-400">
                      {fmt(totalCredit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
