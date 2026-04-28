import { clsx } from 'clsx'

interface CompanyTypeBadgeProps {
  isExternal: boolean
  integration?: string
  className?: string
}

export function CompanyTypeBadge({ isExternal, integration, className }: CompanyTypeBadgeProps) {
  if (!isExternal) {
    return (
      <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/15 text-blue-400', className)}>
        Syncero Flow
      </span>
    )
  }

  const integrationLabel = integration === 'other' ? 'Externo' : 'Manual'

  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--bg-elevated)] text-[var(--text-muted)]', className)}>
      {integrationLabel}
    </span>
  )
}
