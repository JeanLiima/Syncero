import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { Card, Table, Badge, Select, Input } from '@syncero/ui'
import type { FiscalDocument, FiscalDocType } from '@/types'

export function Component() {
  const { companyId } = useParams<{ companyId: string }>()
  const [filterType, setFilterType] = useState<FiscalDocType | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  const { data = [], isLoading } = useQuery({
    queryKey: ['fiscal-docs', companyId, filterType, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from('fiscal_documents')
        .select('*')
        .eq('company_id', companyId!)
        .order('issue_date', { ascending: false })

      if (filterType) q = q.eq('doc_type', filterType)
      if (dateFrom)   q = q.gte('issue_date', dateFrom)
      if (dateTo)     q = q.lte('issue_date', dateTo)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as FiscalDocument[]
    },
    enabled: !!companyId,
  })

  const statusVariant = (s: FiscalDocument['status']) =>
    s === 'authorized' ? 'success' : s === 'cancelled' ? 'danger' : s === 'denied' ? 'danger' : 'warning'

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">Documentos Fiscais</h1>

      <Card padding="sm">
        <div className="flex flex-wrap gap-3 p-2">
          <Select
            options={[
              { value: '',     label: 'Todos os tipos' },
              { value: 'nfe',  label: 'NF-e' },
              { value: 'nfse', label: 'NFS-e' },
              { value: 'cfe',  label: 'CF-e' },
              { value: 'nfce', label: 'NFC-e' },
            ]}
            value={filterType}
            onChange={(v) => setFilterType(v as FiscalDocType | '')}
            className="w-36"
          />
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          <Input type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)}   className="w-40" />
        </div>
      </Card>

      <Card padding="sm">
        <Table
          loading={isLoading}
          data={data}
          rowKey={(r) => r.id}
          emptyMessage="Nenhum documento fiscal encontrado"
          columns={[
            {
              key: 'issue_date',
              header: 'Emissão',
              render: (r) => format(new Date(r.issue_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
            },
            { key: 'doc_type', header: 'Tipo', render: (r) => <Badge variant="info">{r.doc_type.toUpperCase()}</Badge> },
            { key: 'number',   header: 'Número' },
            { key: 'issuer_name', header: 'Emitente', render: (r) => r.issuer_name ?? '—' },
            {
              key: 'value',
              header: 'Valor',
              align: 'right',
              render: (r) => (
                <span className="font-mono">
                  {r.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (r) => <Badge variant={statusVariant(r.status)}>{r.status}</Badge>,
            },
          ]}
        />
      </Card>
    </div>
  )
}
