import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, Pencil, Trash2, BookOpen, Search, Download } from 'lucide-react'
import { Badge, Button, Card, ConfirmDialog, DateRangePicker, Input, Modal, Select, Table, useToast } from '@syncero/ui'
import {
  getTransactions,
  createExtTransaction,
  updateExtTransaction,
  deleteExtTransaction,
} from '@/lib/backend'
import { ClassifyModal } from '@/components/accountant/ClassifyModal'
import { ExportModal } from '@/components/accountant/ExportModal'
import { usePreferencesStore } from '@/store/preferences'
import { useT } from '@/i18n'
import type { Transaction, TransactionNature, TransactionType } from '@/types'

type TxRow = Transaction & { is_classified: boolean; journal_entry_id: string | null }

// ── Form state ────────────────────────────────────────────────

interface FormState {
  type: TransactionType
  description: string
  amount: string
  date: string
  is_paid: boolean
  paid_at: string
  nature: TransactionNature | ''
  notes: string
}

const emptyForm = (): FormState => ({
  type:        'expense',
  description: '',
  amount:      '',
  date:        new Date().toISOString().slice(0, 10),
  is_paid:     false,
  paid_at:     '',
  nature:      '',
  notes:       '',
})

// ── Page ──────────────────────────────────────────────────────

export function Component() {
  const t = useT()
  const { extCompanyId } = useParams<{ extCompanyId: string }>()
  const { language } = usePreferencesStore()
  const qc = useQueryClient()
  const { success: toastSuccess, error: toastError } = useToast()

  const QUERY_KEY = ['ext-transactions', extCompanyId]

  const [filters, setFilters] = useState<{
    type?: TransactionType; is_paid?: boolean; date_from?: string; date_to?: string; search?: string
  }>(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const last = new Date(y, now.getMonth() + 1, 0).getDate()
    return { date_from: `${y}-${m}-01`, date_to: `${y}-${m}-${String(last).padStart(2, '0')}` }
  })
  const [page, setPage] = useState(1)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState<TxRow | null>(null)
  const [form,      setForm]      = useState<FormState>(emptyForm)
  const [saving,    setSaving]    = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<TxRow | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [classifyTx,   setClassifyTx]   = useState<TxRow | null>(null)
  const [exportOpen,   setExportOpen]   = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEY, filters, page],
    queryFn: () => getTransactions({
      extCompanyId: extCompanyId!,
      type:      filters.type,
      is_paid:   filters.is_paid === undefined ? undefined : String(filters.is_paid),
      date_from: filters.date_from,
      date_to:   filters.date_to,
      search:    filters.search,
      page:      String(page),
      pageSize:  '20',
    }),
    enabled: !!extCompanyId,
  })

  const rows = (data?.data ?? []) as TxRow[]
  const totalPages = Math.ceil((data?.count ?? 0) / 20)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (row: TxRow) => {
    setEditing(row)
    setForm({
      type:        row.type,
      description: row.description,
      amount:      String(row.amount),
      date:        row.date,
      is_paid:     row.is_paid,
      paid_at:     row.paid_at ?? '',
      nature:      (row.nature as TransactionNature | null) ?? '',
      notes:       row.notes ?? '',
    })
    setFormError(null)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.description.trim()) { setFormError(t('extTx_errorDescription')); return }
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0)   { setFormError(t('extTx_errorAmount')); return }
    if (!form.date)               { setFormError(t('extTx_errorDate')); return }

    setSaving(true); setFormError(null)
    try {
      const payload = {
        description: form.description.trim(),
        amount,
        type:    form.type,
        date:    form.date,
        is_paid: form.is_paid,
        paid_at: form.is_paid && form.paid_at ? form.paid_at : null,
        nature:  form.nature || null,
        notes:   form.notes.trim() || null,
      }

      if (editing) {
        await updateExtTransaction(editing.id, payload)
      } else {
        await createExtTransaction({ extCompanyId: extCompanyId!, ...payload })
      }

      qc.invalidateQueries({ queryKey: QUERY_KEY })
      toastSuccess(t(editing ? 'extTx_savedSuccess' : 'extTx_createdSuccess'))
      setModalOpen(false)
    } catch {
      setFormError(t('extTx_saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteExtTransaction(deleteTarget.id)
      qc.invalidateQueries({ queryKey: QUERY_KEY })
      toastSuccess(t('extTx_deletedSuccess'))
      setDeleteTarget(null)
    } catch {
      toastError(t('extTx_deleteError'))
    } finally {
      setDeleting(false)
    }
  }

  const natureOptions = [
    { value: '',                    label: t('extTx_natureNone') },
    { value: 'sale_service',        label: t('nature_sale_service') },
    { value: 'loan_received',       label: t('nature_loan_received') },
    { value: 'capital_contribution',label: t('nature_capital_contribution') },
    { value: 'operational_expense', label: t('nature_operational_expense') },
    { value: 'product_cost',        label: t('nature_product_cost') },
    { value: 'asset_purchase',      label: t('nature_asset_purchase') },
    { value: 'debt_payment',        label: t('nature_debt_payment') },
    { value: 'owner_withdrawal',    label: t('nature_owner_withdrawal') },
  ]

  const locale = language === 'en' ? undefined : ptBR

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('extTx_title')}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {data?.count ?? 0} {(data?.count ?? 0) !== 1 ? t('extTx_countPlural') : t('extTx_countSingular')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4" /> {t('export_button')}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> {t('extTx_new')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-40">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <Input
              size="sm"
              placeholder={t('extTx_searchPlaceholder')}
              value={filters.search ?? ''}
              onChange={e => { setPage(1); setFilters(f => ({ ...f, search: e.target.value || undefined })) }}
              className="pl-8"
            />
          </div>
          <Select
            size="sm"
            options={[
              { value: '',        label: t('extTx_allTypes') },
              { value: 'income',  label: t('extTx_income') },
              { value: 'expense', label: t('extTx_expense') },
            ]}
            value={filters.type ?? ''}
            onChange={v => { setPage(1); setFilters(f => ({ ...f, type: v as TransactionType || undefined })) }}
            className="w-40"
          />
          <Select
            size="sm"
            options={[
              { value: '',      label: t('extTx_allStatus') },
              { value: 'true',  label: t('extTx_paid') },
              { value: 'false', label: t('extTx_pending') },
            ]}
            value={filters.is_paid === undefined ? '' : String(filters.is_paid)}
            onChange={v => { setPage(1); setFilters(f => ({ ...f, is_paid: v === '' ? undefined : v === 'true' })) }}
            className="w-44"
          />
          <DateRangePicker
            size="sm"
            from={filters.date_from ?? ''}
            to={filters.date_to ?? ''}
            onChange={(from, to) => { setPage(1); setFilters(f => ({ ...f, date_from: from || undefined, date_to: to || undefined })) }}
            language={language}
          />
        </div>
      </Card>

      {/* Table */}
      <Card padding="sm">
        <Table
          loading={isLoading}
          data={rows}
          rowKey={r => r.id}
          emptyMessage={t('extTx_empty')}
          columns={[
            {
              key: 'date',
              header: t('extTx_date'),
              render: r => format(new Date(r.date + 'T00:00:00'), 'dd/MM/yyyy', { locale }),
            },
            { key: 'description', header: t('extTx_description') },
            {
              key: 'type',
              header: t('extTx_type'),
              render: r => (
                <Badge variant={r.type === 'income' ? 'success' : 'danger'}>
                  {r.type === 'income' ? t('extTx_income') : t('extTx_expense')}
                </Badge>
              ),
            },
            {
              key: 'amount',
              header: t('extTx_amount'),
              align: 'right',
              render: r => (
                <span className={`font-mono ${r.type === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                  {r.type === 'income' ? '+' : '-'}{' '}
                  {r.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              ),
            },
            {
              key: 'status',
              header: t('extTx_status'),
              render: r => (
                <Badge variant={r.is_paid ? 'success' : 'warning'}>
                  {r.is_paid
                    ? (r.type === 'income' ? t('extTx_received') : t('extTx_paid'))
                    : (r.type === 'income' ? t('extTx_toReceive') : t('extTx_pending'))}
                </Badge>
              ),
            },
            {
              key: 'classification',
              header: '',
              render: r => r.is_classified
                ? <Badge variant="success">{t('classify_badge_done')}</Badge>
                : <Badge variant="warning">{t('classify_badge_pending')}</Badge>,
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: r => (
                <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Classify */}
                  {!r.is_classified && (
                    <div className="relative group/tip">
                      <button
                        onClick={e => { e.stopPropagation(); setClassifyTx(r) }}
                        disabled={!r.is_paid}
                        className={`cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] transition-colors ${
                          r.is_paid
                            ? 'text-[var(--text-muted)] hover:text-[var(--success)]'
                            : 'text-[var(--text-muted)] opacity-30 cursor-not-allowed'
                        }`}
                      >
                        <BookOpen className="h-4 w-4" />
                      </button>
                      <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover/tip:opacity-100 transition-opacity z-10">
                        {r.is_paid ? t('classify_action') : t('classify_awaitingPayment')}
                      </span>
                    </div>
                  )}
                  {/* Edit */}
                  <div className="relative group/edit">
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(r) }}
                      className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover/edit:opacity-100 transition-opacity z-10">
                      {t('extTx_edit')}
                    </span>
                  </div>
                  {/* Delete */}
                  <div className="relative group/del">
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteTarget(r) }}
                      className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover/del:opacity-100 transition-opacity z-10">
                      {t('extTx_delete')}
                    </span>
                  </div>
                </div>
              ),
            },
          ]}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--bg-border)]">
            <span className="text-xs text-[var(--text-muted)]">
              {t('extTx_page')} {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                {t('extTx_previous')}
              </Button>
              <Button variant="ghost" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                {t('extTx_next')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('extTx_edit') : t('extTx_new')}
        size="md"
        footer={
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)} disabled={saving}>
              {t('extTx_cancel')}
            </Button>
            <Button size="sm" onClick={handleSave} loading={saving}>
              {t('extTx_save')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--text-secondary)]">{t('extTx_type')}</span>
            <div className="flex gap-2">
              {(['income', 'expense'] as const).map(tp => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: tp }))}
                  className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                    form.type === tp
                      ? tp === 'income' ? 'bg-[var(--success)] text-white' : 'bg-[var(--danger)] text-white'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {tp === 'income' ? t('extTx_income') : t('extTx_expense')}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <Input
            label={t('extTx_description')}
            placeholder={t('extTx_descriptionPlaceholder')}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('extTx_amount')}
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            />
            <Input
              label={t('extTx_date')}
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            />
          </div>

          {/* Nature */}
          <Select
            label={t('extTx_nature')}
            options={natureOptions}
            value={form.nature}
            onChange={v => setForm(f => ({ ...f, nature: v as TransactionNature | '' }))}
          />

          {/* Paid toggle */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--text-secondary)]">{t('extTx_status')}</span>
            <div className="flex gap-2">
              {([false, true] as const).map(paid => (
                <button
                  key={String(paid)}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_paid: paid, paid_at: paid ? f.paid_at : '' }))}
                  className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                    form.is_paid === paid
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {paid
                    ? (form.type === 'income' ? t('extTx_received') : t('extTx_paid'))
                    : (form.type === 'income' ? t('extTx_toReceive') : t('extTx_pending'))}
                </button>
              ))}
            </div>
          </div>

          {/* Paid at — only when paid */}
          {form.is_paid && (
            <Input
              label={t('extTx_paidAt')}
              type="date"
              value={form.paid_at}
              onChange={e => setForm(f => ({ ...f, paid_at: e.target.value }))}
            />
          )}

          {/* Notes */}
          <Input
            label={t('extTx_notes')}
            placeholder={t('extTx_notesPlaceholder')}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />

          {formError && <p className="text-xs text-[var(--danger)]">{formError}</p>}
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('extTx_deleteTitle')}
        message={t('extTx_deleteConfirm')}
        confirmLabel={t('extTx_deleteConfirmYes')}
        loading={deleting}
      />

      {/* Classify */}
      <ClassifyModal
        transaction={classifyTx}
        open={!!classifyTx}
        onClose={() => setClassifyTx(null)}
        extCompanyId={extCompanyId!}
      />

      {/* Export */}
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filters={filters}
        extCompanyId={extCompanyId!}
      />
    </div>
  )
}
