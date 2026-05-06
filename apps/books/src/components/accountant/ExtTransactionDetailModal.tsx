import { format, parseISO } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'
import { TrendingUp, TrendingDown, BookOpen, Pencil, CheckCircle, Edit2 } from 'lucide-react'
import { Badge, Button, Modal } from '@syncero/ui'
import { useT } from '@/i18n'
import type { Transaction } from '@/types'

type TxRow = Transaction & { is_classified: boolean; journal_entry_id: string | null; counterpart?: string | null }

interface Props {
  tx: TxRow | null
  open: boolean
  onClose: () => void
  onEdit: (tx: TxRow) => void
  onClassify: (tx: TxRow) => void
  language: 'pt' | 'en'
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-[var(--text-muted)] shrink-0">{label}</span>
      <span className="text-sm text-[var(--text-primary)] text-right">{children}</span>
    </div>
  )
}

function TimelineEvent({ icon, color, label, date }: { icon: React.ReactNode; color: string; label: string; date: string }) {
  return (
    <div className="flex gap-3">
      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${color}`}>
        {icon}
      </div>
      <div className="flex flex-col gap-0.5 pb-4">
        <p className="text-sm text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-muted)]">{date}</p>
      </div>
    </div>
  )
}

const NATURE_KEYS: Record<string, string> = {
  sale_service:         'nature_sale_service',
  loan_received:        'nature_loan_received',
  capital_contribution: 'nature_capital_contribution',
  operational_expense:  'nature_operational_expense',
  product_cost:         'nature_product_cost',
  asset_purchase:       'nature_asset_purchase',
  debt_payment:         'nature_debt_payment',
  owner_withdrawal:     'nature_owner_withdrawal',
}

export function ExtTransactionDetailModal({ tx, open, onClose, onEdit, onClassify, language }: Props) {
  const t = useT()
  const locale = language === 'en' ? enUS : ptBR

  if (!tx) return null

  const isIncome = tx.type === 'income'
  const fmt = (iso: string) => format(parseISO(iso.includes('T') ? iso : iso + 'T00:00:00'), 'dd/MM/yyyy', { locale })
  const fmtFull = (iso: string) => format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale })

  const natureLabel = tx.nature ? t(NATURE_KEYS[tx.nature] as Parameters<typeof t>[0]) : null

  const timeline: Array<{ key: string; icon: React.ReactNode; color: string; label: string; date: string }> = []
  timeline.push({
    key: 'created',
    icon: <TrendingUp className="h-3 w-3 text-white" />,
    color: 'bg-[var(--accent)]',
    label: t('transactions_detail_histCreated'),
    date: fmtFull(tx.created_at),
  })
  if (new Date(tx.updated_at).getTime() - new Date(tx.created_at).getTime() > 60_000) {
    timeline.push({
      key: 'updated',
      icon: <Edit2 className="h-3 w-3 text-white" />,
      color: 'bg-[var(--text-muted)]',
      label: t('transactions_detail_histUpdated'),
      date: fmtFull(tx.updated_at),
    })
  }
  if (tx.paid_at) {
    timeline.push({
      key: 'paid_at',
      icon: <CheckCircle className="h-3 w-3 text-white" />,
      color: 'bg-[var(--success)]',
      label: isIncome ? t('transactions_detail_histReceivedAt') : t('transactions_detail_histPaidAt'),
      date: fmt(tx.paid_at),
    })
  }

  const footer = (
    <div className="flex items-center justify-between gap-2">
      <Button variant="ghost" size="sm" onClick={onClose}>
        {t('transactions_close')}
      </Button>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { onClose(); onEdit(tx) }}
        >
          <Pencil className="h-3.5 w-3.5" />
          {t('extTx_edit')}
        </Button>
        {tx.is_paid && !tx.is_classified && (
          <Button
            size="sm"
            onClick={() => { onClose(); onClassify(tx) }}
          >
            <BookOpen className="h-3.5 w-3.5" />
            {t('classify_action')}
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title={t('transactions_detailTitle')} size="md" footer={footer}>
      <div className="flex flex-col gap-6">

        {/* Amount hero */}
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="flex items-center gap-2">
            {isIncome
              ? <TrendingUp  className="h-5 w-5 text-[var(--success)]" />
              : <TrendingDown className="h-5 w-5 text-[var(--danger)]" />
            }
            <span className={`text-3xl font-bold font-mono ${isIncome ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
              {isIncome ? '+' : '-'}{tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <Badge variant={isIncome ? 'success' : 'danger'}>
              {isIncome ? t('extTx_income') : t('extTx_expense')}
            </Badge>
            <Badge variant={tx.is_paid ? 'success' : 'warning'}>
              {tx.is_paid
                ? (isIncome ? t('extTx_received') : t('extTx_paid'))
                : (isIncome ? t('extTx_toReceive') : t('extTx_pending'))}
            </Badge>
            {tx.is_classified && (
              <Badge variant="success">{t('classify_badge_done')}</Badge>
            )}
            {!tx.is_classified && (
              <Badge variant="warning">{t('classify_badge_pending')}</Badge>
            )}
          </div>
        </div>

        <div className="h-px bg-[var(--bg-border)]" />

        {/* Details */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {t('transactions_detail_sectionDetails')}
          </p>
          <Row label={t('extTx_date')}>{fmt(tx.date)}</Row>
          <Row label={t('transactions_detail_description')}>{tx.description}</Row>
          {natureLabel && (
            <Row label={t('extTx_nature')}>{natureLabel}</Row>
          )}
          {tx.counterpart && (
            <Row label={isIncome ? t('extTx_counterpartIncome') : t('extTx_counterpartExpense')}>
              {tx.counterpart}
            </Row>
          )}
          {tx.paid_at && (
            <Row label={t('extTx_paidAt')}>{fmt(tx.paid_at)}</Row>
          )}
          {tx.notes && (
            <Row label={t('transactions_detail_notes')}>{tx.notes}</Row>
          )}
        </div>

        <div className="h-px bg-[var(--bg-border)]" />

        {/* History timeline */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {t('transactions_detail_sectionHistory')}
          </p>
          <div className="relative ml-3 border-l border-[var(--bg-border)] pl-4">
            {timeline.map(({ key, ...e }) => (
              <TimelineEvent key={key} {...e} />
            ))}
          </div>
        </div>

      </div>
    </Modal>
  )
}
