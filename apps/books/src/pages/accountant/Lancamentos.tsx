import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { Button, Card, Badge } from '@syncero/ui'
import { JournalEntryModal } from '@/components/accountant/JournalEntryModal'
import { DominioImportModal } from '@/components/accountant/DominioImportModal'
import type { JournalEntry, AccountPlan, EntrySource } from '@/types'
import type { ParsedEntry } from '@/lib/dominio'

const sourceLabel: Record<EntrySource, string> = {
  manual: 'Manual',
  dominio_import: 'Domínio',
  api: 'API',
  syncero_import: 'Syncero',
}

const sourceVariant: Record<EntrySource, 'default' | 'info' | 'success' | 'warning'> = {
  manual: 'default',
  dominio_import: 'info',
  api: 'success',
  syncero_import: 'warning',
}

export function Component() {
  const { user } = useAuth()
  const { id, isExternal, canWrite } = useCompanyContext()
  const qc = useQueryClient()

  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7))

  const queryKey = ['journal-entries', id, period]

  const { data: entries = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const dateFrom = `${period}-01`
      const dateTo = `${period}-31`
      const q = supabase
        .from('journal_entries')
        .select('*, journal_entry_lines(*, account_plans(code, name))')
        .gte('entry_date', dateFrom)
        .lte('entry_date', dateTo)
        .order('entry_date', { ascending: false })
      const filtered = isExternal ? q.eq('ext_company_id', id) : q.eq('company_id', id)
      const { data, error } = await filtered
      if (error) throw error
      return (data ?? []) as JournalEntry[]
    },
    enabled: !!id,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['account-plans-analytic', id],
    queryFn: async () => {
      const q = supabase.from('account_plans').select('id, code, name').eq('is_analytic', true).eq('is_active', true).order('code')
      const filtered = isExternal ? q.eq('ext_company_id', id) : q.eq('company_id', id)
      const { data } = await filtered
      return (data ?? []) as Pick<AccountPlan, 'id' | 'code' | 'name'>[]
    },
    enabled: !!id,
  })

  const handleCreateEntry = async (data: {
    entry_date: string; description: string; external_ref: string
    lines: Array<{ account_plan_id: string; side: 'debit' | 'credit'; amount: number; memo: string }>
  }) => {
    if (!user?.id) return
    const { data: entry, error } = await supabase
      .from('journal_entries')
      .insert({
        ...(isExternal ? { ext_company_id: id } : { company_id: id }),
        accountant_id: user.id,
        entry_date: data.entry_date,
        description: data.description,
        external_ref: data.external_ref || null,
        source: 'manual',
      })
      .select('id')
      .single()
    if (error) throw error

    await supabase.from('journal_entry_lines').insert(
      data.lines.map(l => ({ entry_id: entry.id, account_plan_id: l.account_plan_id, side: l.side, amount: l.amount, memo: l.memo || null }))
    )
    qc.invalidateQueries({ queryKey })
  }

  const handleDominioImport = async (parsedEntries: ParsedEntry[], accountsByCode: Map<string, string>) => {
    if (!user?.id) return
    for (const pe of parsedEntries) {
      const { data: entry, error } = await supabase
        .from('journal_entries')
        .insert({
          ...(isExternal ? { ext_company_id: id } : { company_id: id }),
          accountant_id: user.id,
          entry_date: pe.entry_date,
          description: pe.description,
          external_ref: pe.external_ref || null,
          source: 'dominio_import',
        })
        .select('id')
        .single()
      if (error) throw error

      const lines = pe.lines.map(l => ({
        entry_id: entry.id,
        account_plan_id: accountsByCode.get(l.account_code)!,
        side: l.side,
        amount: l.amount,
        memo: l.memo || null,
      }))
      await supabase.from('journal_entry_lines').insert(lines)
    }
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
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Lançamentos Contábeis</h1>
          <p className="text-sm text-[var(--text-muted)]">{entries.length} lançamento{entries.length !== 1 ? 's' : ''} em {period}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="h-9 px-3 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          {canWrite && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setImportModalOpen(true)}>
                <Upload className="h-4 w-4" />
                Importar Domínio
              </Button>
              <Button size="sm" onClick={() => setEntryModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Novo lançamento
              </Button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : entries.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">Nenhum lançamento em {period}.</p>
            {canWrite && (
              <Button size="sm" variant="ghost" onClick={() => setEntryModalOpen(true)}>Criar lançamento</Button>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--bg-border)] text-left">
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] w-28">Data</th>
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Histórico</th>
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Contas debitadas</th>
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Contas creditadas</th>
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] w-32 text-right">Valor</th>
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] w-24">Origem</th>
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
