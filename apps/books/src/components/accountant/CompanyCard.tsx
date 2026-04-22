import { Link } from 'react-router-dom'
import { Building2, ArrowRight } from 'lucide-react'
import { Card, Badge } from '@syncero/ui'
import { CompanyTypeBadge } from './CompanyTypeBadge'
import type { TaxRegime } from '@/types'

interface CompanyCardProps {
  id: string
  name: string
  cnpj: string | null
  taxRegime: TaxRegime | null
  isExternal: boolean
  integration?: string
}

const taxRegimeLabel: Record<TaxRegime, string> = {
  simples: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
}

export function CompanyCard({ id, name, cnpj, taxRegime, isExternal, integration }: CompanyCardProps) {
  const href = isExternal ? `/accountant/external/${id}` : `/accountant/company/${id}`

  const formattedCnpj = cnpj
    ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : null

  return (
    <Link to={href}>
      <Card className="hover:border-[var(--accent)] transition-colors cursor-pointer group h-full">
        <div className="flex items-start justify-between mb-3">
          <div className="h-10 w-10 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <ArrowRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors flex-shrink-0 mt-0.5" />
        </div>
        <h3 className="font-semibold text-[var(--text-primary)] mb-1 leading-snug">{name}</h3>
        {formattedCnpj && (
          <p className="text-xs text-[var(--text-muted)] mb-2 font-mono">{formattedCnpj}</p>
        )}
        <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
          <CompanyTypeBadge isExternal={isExternal} integration={integration} />
          {taxRegime && (
            <Badge variant="info" className="text-xs">
              {taxRegimeLabel[taxRegime]}
            </Badge>
          )}
        </div>
      </Card>
    </Link>
  )
}
