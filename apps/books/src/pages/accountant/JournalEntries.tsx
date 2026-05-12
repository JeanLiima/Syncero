import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Plus, Search } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'
import { apiFetch } from '@/lib/api'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { Badge, Button, Card, Input, MonthPicker, SkeletonRows } from '@syncero/ui'
import { usePreferencesStore } from '@/store/preferences'
import { JournalEntryModal } from '@/components/accountant/JournalEntryModal'
import { JournalEntryDetailModal } from '@/components/accountant/JournalEntryDetailModal'
import { JournalExportModal } from '@/components/accountant/JournalExportModal'
import { useT } from '@/i18n'
import type { JournalEntry, AccountPlan, EntrySource } from '@/types'

const sourceVariant: Record<EntrySource, 'default' | 'info' | 'success' | 'warning'> = {
  manual: 'default',
  api: 'success',
  syncero_import: 'warning',
}

export function Component() {
  const t = useT()
  const sourceLabel: Record<string, string> = {
    manual: t('lancamentos_sourceManual'),
    api: t('lancamentos_sourceApi'),
    syncero_import: t('lancamentos_sourceSyncero'),
  }
  const { id, isExternal, canWrite } = useCompanyContext()
  const language = usePreferencesStore(s => s.language)
  const locale = language === 'en' ? enUS : ptBR
  const qc = useQueryClient()

  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7))
  const [search, setSearch]               = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [detailEntry, setDetailEntry]     = useState<JournalEntry | null>(null)
  const [exportOpen, setExportOpen]       = useState(false)

  const periodLabel = (() => {
    const raw = format(parseISO(`${period}-01`), 'MMMM yyyy', { locale })
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  })()

  const queryKey = ['journal-entries', id, period]
  const companyParam = isExternal ? `ext_company_id=${id}` : `company_id=${id}`

  const { data: entries = [], isLoading } = useQuery({
    queryKey,
    queryFn: ({ signal }) => apiFetch<JournalEntry[]>(`/api/journal-entries?${companyParam}&period=${period}`, {}, signal),
    enabled: !!id,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['account-plans-analytic', id],
    queryFn: ({ signal }) => apiFetch<AccountPlan[]>(`/api/account-plans?${companyParam}`, {}, signal).then(data =>
      data.filter(p => p.is_analytic)
    ),
    enabled: !!id,
  })

  // Client-side filtering
  const filtered = useMemo(() => {
    let result = entries
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(e =>
        e.description.toLowerCase().includes(q) ||
        (e.external_ref ?? '').toLowerCase().includes(q)
      )
    }
    if (accountFilter.trim()) {
      const q = accountFilter.toLowerCase()
      result = result.filter(e =>
        (e.journal_entry_lines ?? []).some(l =>
          (l.account_plans?.code ?? '').toLowerCase().includes(q) ||
          (l.account_plans?.name ?? '').toLowerCase().includes(q)
        )
      )
    }
    return result
  }, [entries, search, accountFilter])

  const handleCreateEntry = async (data: {
    entry_date: string; description: string; external_ref: string
    lines: Array<{ account_plan_id: string; side: 'debit' | 'credit'; amount: number; memo: string }>
  }) => {
    await apiFetch('/api/journal-entries', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        ...(isExternal ? { ext_company_id: id } : { company_id: id }),
      }),
    })
    qc.invalidateQueries({ queryKey })
  }

  const getEntryTotal = (entry: JournalEntry) => {
    return (entry.journal_entry_lines ?? [])
      .filter(l => l.side === 'debit')
      .reduce((s, l) => s + Number(l.amount), 0)
  }

  const isFiltering = search.trim() !== '' || accountFilter.trim() !== ''

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('lancamentos_title')}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {isFiltering
              ? t('lancamentos_filterCount').replace('{count}', String(filtered.length)).replace('{total}', String(entries.length))
              : `${entries.length} ${entries.length !== 1 ? t('lancamentos_countPlural') : t('lancamentos_countSingular')} — ${periodLabel}`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4" />
            {t('lancamentos_export')}
          </Button>
          {canWrite && (
            <Button size="sm" onClick={() => setEntryModalOpen(true)}>
              <Plus className="h-4 w-4" />
              {t('lancamentos_new')}
            </Button>
          )}
        </div>
      </div>

      {/* Filters card */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-3">
          <MonthPicker
            value={period}
            onChange={setPeriod}
            language={language}
            size="sm"
          />
          <div className="relative flex-1 min-w-48">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <Input
              size="sm"
              placeholder={t('lancamentos_searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="relative flex-1 min-w-48">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <Input
              size="sm"
              placeholder={t('lancamentos_accountFilterPlaceholder')}
              value={accountFilter}
              onChange={e => setAccountFilter(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      {isLoading ? (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <tbody><SkeletonRows rows={6} cols={6} /></tbody>
          </table>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              {isFiltering
                ? 'Nenhum lançamento encontrado para os filtros aplicados.'
                : `${t('lancamentos_emptyPeriod')} ${periodLabel}.`}
            </p>
            {canWrite && !isFiltering && (
              <Button size="sm" variant="ghost" onClick={() => setEntryModalOpen(true)}>{t('lancamentos_create')}</Button>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--bg-border)] text-left">
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] w-28">{t('lancamentos_colDate')}</th>
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">{t('lancamentos_colHistory')}</th>
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">{t('lancamentos_colDebited')}</th>
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">{t('lancamentos_colCredited')}</th>
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] w-32 text-right">{t('lancamentos_colValue')}</th>
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] w-24">{t('lancamentos_colSource')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                const lines = entry.journal_entry_lines ?? []
                const debits  = lines.filter(l => l.side === 'debit').map(l => l.account_plans?.code ?? '').join(', ')
                const credits = lines.filter(l => l.side === 'credit').map(l => l.account_plans?.code ?? '').join(', ')
                const total = getEntryTotal(entry)
                return (
                  <tr
                    key={entry.id}
                    onClick={() => setDetailEntry(entry)}
                    className="border-b border-[var(--bg-border)]/50 hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-xs font-mono text-[var(--text-muted)]">
                      {new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-primary)]">
                      <div>{entry.description}</div>
                      {entry.external_ref && (
                        <div className="text-xs text-[var(--text-muted)]">#{entry.external_ref}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-blue-400">{debits}</td>
                    <td className="px-4 py-3 text-xs font-mono text-green-400">{credits}</td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)]">
                      {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={sourceVariant[entry.source]} className="text-xs">
                        {sourceLabel[entry.source]}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Modals */}
      {canWrite && (
        <JournalEntryModal
          open={entryModalOpen}
          onClose={() => setEntryModalOpen(false)}
          onSubmit={handleCreateEntry}
          accounts={accounts}
        />
      )}

      <JournalEntryDetailModal
        entry={detailEntry}
        open={!!detailEntry}
        onClose={() => setDetailEntry(null)}
        sourceLabel={sourceLabel}
      />

      <JournalExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        entries={filtered}
        period={period}
      />
    </div>
  )
}
