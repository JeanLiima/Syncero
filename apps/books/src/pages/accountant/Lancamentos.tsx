import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Upload } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'
import { apiFetch } from '@/lib/api'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { Button, Card, Badge, MonthPicker } from '@syncero/ui'
import { usePreferencesStore } from '@/store/preferences'
import { JournalEntryModal } from '@/components/accountant/JournalEntryModal'
import { DominioImportModal } from '@/components/accountant/DominioImportModal'
import { useT } from '@/i18n'
import type { JournalEntry, AccountPlan, EntrySource } from '@/types'
import type { ParsedEntry } from '@/lib/dominio'

const sourceVariant: Record<EntrySource, 'default' | 'info' | 'success' | 'warning'> = {
  manual: 'default',
  dominio_import: 'info',
  api: 'success',
  syncero_import: 'warning',
}

export function Component() {
  const t = useT()
  const sourceLabel: Record<string, string> = {
    manual: t('lancamentos_sourceManual'),
    dominio_import: t('lancamentos_sourceDominio'),
    api: t('lancamentos_sourceApi'),
    syncero_import: t('lancamentos_sourceSyncero'),
  }
  const { id, isExternal, canWrite } = useCompanyContext()
  const language = usePreferencesStore(s => s.language)
  const locale = language === 'en' ? enUS : ptBR
  const qc = useQueryClient()

  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7))

  const periodLabel = (() => {
    const raw = format(parseISO(`${period}-01`), 'MMMM yyyy', { locale })
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  })()

  const queryKey = ['journal-entries', id, period]
  const companyParam = isExternal ? `extCompanyId=${id}` : `companyId=${id}`

  const { data: entries = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => apiFetch<JournalEntry[]>(`/api/journal-entries?${companyParam}&period=${period}`),
    enabled: !!id,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['account-plans-analytic', id],
    queryFn: () => apiFetch<AccountPlan[]>(`/api/account-plans?${companyParam}`).then(data =>
      data.filter(p => p.is_analytic)
    ),
    enabled: !!id,
  })

  const handleCreateEntry = async (data: {
    entry_date: string; description: string; external_ref: string
    lines: Array<{ account_plan_id: string; side: 'debit' | 'credit'; amount: number; memo: string }>
  }) => {
    await apiFetch('/api/journal-entries', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        ...(isExternal ? { extCompanyId: id } : { companyId: id }),
      }),
    })
    qc.invalidateQueries({ queryKey })
  }

  const handleDominioImport = async (parsedEntries: ParsedEntry[], _accountsByCode: Map<string, string>) => {
    await apiFetch('/api/journal-entries/import', {
      method: 'POST',
      body: JSON.stringify({
        entries: parsedEntries,
        ...(isExternal ? { extCompanyId: id } : { companyId: id }),
      }),
    })
    qc.invalidateQueries({ queryKey })
  }

  const getEntryTotal = (entry: JournalEntry) => {
    const lines = (entry as any).journal_entry_lines ?? []
    return lines.filter((l: any) => l.side === 'debit').reduce((s: number, l: any) => s + Number(l.amount), 0)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('lancamentos_title')}</h1>
          <p className="text-sm text-[var(--text-muted)]">{entries.length} {entries.length !== 1 ? t('lancamentos_countPlural') : t('lancamentos_countSingular')} — {periodLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthPicker
            value={period}
            onChange={setPeriod}
            language={language}
            size="sm"
          />
          {canWrite && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setImportModalOpen(true)}>
                <Upload className="h-4 w-4" />
                {t('lancamentos_importDominio')}
              </Button>
              <Button size="sm" onClick={() => setEntryModalOpen(true)}>
                <Plus className="h-4 w-4" />
                {t('lancamentos_new')}
              </Button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">{t('lancamentos_loading')}</p>
      ) : entries.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">{t('lancamentos_emptyPeriod')} {periodLabel}.</p>
            {canWrite && (
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
              {entries.map((entry) => {
                const lines = (entry as any).journal_entry_lines ?? []
                const debits = lines.filter((l: any) => l.side === 'debit').map((l: any) => l.account_plans?.code ?? '').join(', ')
                const credits = lines.filter((l: any) => l.side === 'credit').map((l: any) => l.account_plans?.code ?? '').join(', ')
                const total = getEntryTotal(entry)
                return (
                  <tr key={entry.id} className="border-b border-[var(--bg-border)]/50 hover:bg-[var(--bg-elevated)] transition-colors">
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

      {canWrite && (
        <>
          <JournalEntryModal
            open={entryModalOpen}
            onClose={() => setEntryModalOpen(false)}
            onSubmit={handleCreateEntry}
            accounts={accounts}
          />
          <DominioImportModal
            open={importModalOpen}
            onClose={() => setImportModalOpen(false)}
            onImport={handleDominioImport}
            accounts={accounts}
          />
        </>
      )}
    </div>
  )
}
