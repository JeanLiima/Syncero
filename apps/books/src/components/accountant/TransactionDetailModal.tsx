import { format, parseISO } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'
import { TrendingUp, TrendingDown, CheckCircle, Clock, Edit2, BookOpen } from 'lucide-react'
import { Badge, Button, Modal } from '@syncero/ui'
import { useQuery } from '@tanstack/react-query'
import { getTransactionDetail } from '@/lib/backend'
import { useT } from '@/i18n'
import type { TransactionDetail } from '@/types'

interface Props {
  transactionId: string | null
  open: boolean
  onClose: () => void
  onClassify?: () => void
  isClassified?: boolean
  language: 'pt' | 'en'
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{title}</p>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-[var(--text-muted)] shrink-0">{label}</span>
      <span className="text-sm text-[var(--text-primary)] text-right">{children}</span>
    </div>
  )
}

function TimelineEvent({ icon, color, label, date, by, sub }: {
  icon: React.ReactNode; color: string; label: string
  date: string; by?: string | null; sub?: string | null
}) {
  return (
    <div className="flex gap-3">
      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${color}`}>
        {icon}
      </div>
      <div className="flex flex-col gap-0.5 pb-4">
        <p className="text-sm text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-muted)]">{date}{by ? ` · por ${by}` : ''}</p>
        {sub && <p className="text-xs text-[var(--text-muted)] mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export function TransactionDetailModal({ transactionId, open, onClose, onClassify, isClassified, language }: Props) {
  const t = useT()
  const locale = language === 'en' ? enUS : ptBR

  const { data: tx, isLoading } = useQuery({
    queryKey: ['transaction', transactionId],
    queryFn: () => getTransactionDetail(transactionId!),
    enabled: !!transactionId && open,
  })

  const fmt = (iso: string, withTime = false) => {
    const d = parseISO(iso)
    return withTime
      ? format(d, "dd/MM/yyyy 'às' HH:mm", { locale })
      : format(d, 'dd/MM/yyyy', { locale })
  }

  const isIncome = tx?.type === 'income'

  const timeline: Array<{
    key: string; icon: React.ReactNode; color: string
    label: string; date: string; by?: string | null; sub?: string | null
  }> = []

  if (tx) {
    timeline.push({
      key: 'created',
      icon: <TrendingUp className="h-3 w-3 text-white" />,
      color: 'bg-[var(--accent)]',
      label: t('transactions_detail_histCreated'),
      date: fmt(tx.created_at, true),
      by: (tx as TransactionDetail).creator_name,
    })

    if (new Date(tx.updated_at).getTime() - new Date(tx.created_at).getTime() > 60_000) {
      timeline.push({
        key: 'updated',
        icon: <Edit2 className="h-3 w-3 text-white" />,
        color: 'bg-[var(--text-muted)]',
        label: t('transactions_detail_histUpdated'),
        date: fmt(tx.updated_at, true),
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

    if (tx.payment_registered_at) {
      const methodLabel = tx.payment_method === 'cash'
        ? t('transactions_detail_cash')
        : tx.payment_method === 'bank'
        ? `${t('transactions_detail_bank')}${tx.banks?.name ? ` · ${tx.banks.name}` : ''}`
        : null

      timeline.push({
        key: 'registered',
        icon: <Clock className="h-3 w-3 text-white" />,
        color: 'bg-[var(--warning)]',
        label: isIncome ? t('transactions_detail_histRegisteredIncome') : t('transactions_detail_histRegistered'),
        date: fmt(tx.payment_registered_at, true),
        by: (tx as TransactionDetail).payment_registrar_name,
        sub: methodLabel,
      })
    }
  }

  const footer = (
    <div className="flex items-center justify-between">
      <Button variant="ghost" size="sm" onClick={onClose}>
        {t('transactions_close')}
      </Button>
      {tx && tx.is_paid && !isClassified && onClassify && (
        <Button size="sm" onClick={() => { onClose(); onClassify() }}>
          <BookOpen className="h-3.5 w-3.5" />
          {t('classify_action')}
        </Button>
      )}
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title={t('transactions_detailTitle')} size="md" footer={footer}>
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      )}

      {!isLoading && tx && (
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
            <div className="flex items-center gap-2">
              <Badge variant={isIncome ? 'success' : 'danger'}>
                {isIncome ? t('transactions_income_badge') : t('transactions_expense_badge')}
              </Badge>
              <Badge variant={tx.is_paid ? 'success' : 'warning'}>
                {tx.is_paid
                  ? (isIncome ? t('transactions_received') : t('transactions_paid'))
                  : (isIncome ? t('transactions_toReceive') : t('transactions_pending'))}
              </Badge>
              {isClassified && (
                <Badge variant="info">{t('classify_badge_done')}</Badge>
              )}
            </div>
          </div>

          <div className="h-px bg-[var(--bg-border)]" />

          {/* Details */}
          <Section title={t('transactions_detail_sectionDetails')}>
            <Row label={t('transactions_detail_competencyDate')}>
              {fmt(tx.date + 'T00:00:00')}
            </Row>
            {tx.categories && (
              <Row label={t('transactions_detail_category')}>
                <span className="flex items-center gap-1.5 justify-end">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: tx.categories.color ?? '#94a3b8' }}
                  />
                  {tx.categories.name}
                </span>
              </Row>
            )}
            {tx.contacts && (
              <Row label={t('transactions_detail_contact')}>
                <span className="flex flex-col items-end gap-0.5">
                  <span>{tx.contacts.name}</span>
                  {tx.contacts.cpf  && <span className="text-xs text-[var(--text-muted)]">CPF {tx.contacts.cpf}</span>}
                  {tx.contacts.cnpj && <span className="text-xs text-[var(--text-muted)]">CNPJ {tx.contacts.cnpj}</span>}
                </span>
              </Row>
            )}
            {tx.description && (
              <Row label={t('transactions_detail_description')}>{tx.description}</Row>
            )}
            {tx.notes && (
              <Row label={t('transactions_detail_notes')}>{tx.notes}</Row>
            )}
            {tx.is_installment && tx.installment_number != null && tx.installment_count != null && (
              <Row label={t('transactions_detail_installment')}>
                {tx.installment_number}/{tx.installment_count}
              </Row>
            )}
          </Section>

          <div className="h-px bg-[var(--bg-border)]" />

          {/* Timeline */}
          <Section title={t('transactions_detail_sectionHistory')}>
            <div className="relative ml-3 border-l border-[var(--bg-border)] pl-4">
              {timeline.map(({ key, ...e }) => (
                <TimelineEvent key={key} {...e} />
              ))}
            </div>
          </Section>

        </div>
      )}
    </Modal>
  )
}
