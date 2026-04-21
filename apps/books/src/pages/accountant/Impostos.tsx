import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { Card, Table, Badge } from '@syncero/ui'
import type { TaxCalculation } from '@/types'

export function Component() {
  const { companyId } = useParams<{ companyId: string }>()

  const { data = [], isLoading } = useQuery({
    queryKey: ['tax-calculations', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_calculations')
        .select('*')
        .eq('company_id', companyId!)
        .order('reference_period', { ascending: false })
      if (error) throw error
      return (data ?? []) as TaxCalculation[]
    },
    enabled: !!companyId,
  })

  // Group by period
  const grouped = data.reduce<Record<string, TaxCalculation[]>>((acc, t) => {
    (acc[t.reference_period] ??= []).push(t)
    return acc
  }, {})

  const statusVariant = (s: TaxCalculation['status']) =>
    s === 'paid' ? 'success' : s === 'calculated' ? 'info' : 'warning'

  const statusLabel = (s: TaxCalculation['status']) =>
    s === 'paid' ? 'Pago' : s === 'calculated' ? 'Calculado' : 'Rascunho'

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">Impostos</h1>

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--text-muted)] text-center py-6">Nenhum cálculo de imposto encontrado</p>
        </Card>
      ) : (
        Object.entries(grouped).map(([period, rows]) => {
          const total = rows.reduce((s, r) => s + r.tax_value, 0)
          return (
            <Card key={period} padding="sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--bg-border)]">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Período: {period}
                </h2>
                <span className="font-mono text-sm text-[var(--danger)] font-semibold">
                  Total: {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <Table
                data={rows}
                rowKey={(r) => r.id}
                columns={[
                  { key: 'tax_type', header: 'Imposto' },
                  {
                    key: 'base_value',
                    header: 'Base de cálculo',
                    align: 'right',
                    render: (r) => (
                      <span className="font-mono">
                        {r.base_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    ),
                  },
                  {
                    key: 'rate',
                    header: 'Alíquota',
                    align: 'right',
                    render: (r) => `${(r.rate * 100).toFixed(2)}%`,
                  },
                  {
                    key: 'tax_value',
                    header: 'Valor',
                    align: 'right',
                    render: (r) => (
                      <span className="font-mono font-medium text-[var(--danger)]">
                        {r.tax_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    ),
                  },
                  {
                    key: 'due_date',
                    header: 'Vencimento',
                    render: (r) =>
                      r.due_date
                        ? format(new Date(r.due_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                        : '—',
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (r) => <Badge variant={statusVariant(r.status)}>{statusLabel(r.status)}</Badge>,
                  },
                ]}
              />
            </Card>
          )
        })
      )}
    </div>
  )
}
