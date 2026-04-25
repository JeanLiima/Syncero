import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, Table, Badge } from '@syncero/ui'
import { getFiscalBooks } from '@/lib/backend'
import { useT } from '@/i18n'
import type { FiscalBook } from '@/types'

export function Component() {
  const t = useT()
  const { companyId } = useParams<{ companyId: string }>()

  const { data = [], isLoading } = useQuery({
    queryKey: ['fiscal-books', companyId],
    queryFn: async () => getFiscalBooks(companyId!),
    enabled: !!companyId,
  })

  const statusVariant = (s: FiscalBook['status']) =>
    s === 'transmitted' ? 'success' : s === 'validated' ? 'info' : 'warning'

  const statusLabel = (s: FiscalBook['status']) =>
    s === 'transmitted' ? t('sped_transmitted') : s === 'validated' ? t('sped_validated') : t('sped_draft')

  const bookLabel = (type: FiscalBook['book_type']) => ({
    sped_fiscal: 'SPED Fiscal',
    sped_contribuicoes: 'SPED Contribuições',
    ecf: 'ECF',
    ecd: 'ECD',
  }[type] ?? type)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('sped_title')}</h1>

      <Card padding="sm">
        <Table
          loading={isLoading}
          data={data}
          rowKey={(r) => r.id}
          emptyMessage={t('sped_empty')}
          columns={[
            { key: 'reference_period', header: t('sped_period') },
            { key: 'book_type', header: t('sped_type'), render: (r) => bookLabel(r.book_type) },
            {
              key: 'status',
              header: t('sped_status'),
              render: (r) => <Badge variant={statusVariant(r.status)}>{statusLabel(r.status)}</Badge>,
            },
            {
              key: 'transmitted_at',
              header: t('sped_transmittedAt'),
              render: (r) =>
                r.transmitted_at
                  ? format(new Date(r.transmitted_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                  : '—',
            },
            {
              key: 'file_url',
              header: t('sped_file'),
              render: (r) =>
                r.file_url ? (
                  <a href={r.file_url} target="_blank" rel="noreferrer" className="text-[var(--accent)] text-xs hover:underline">
                    {t('sped_download')}
                  </a>
                ) : (
                  '—'
                ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
