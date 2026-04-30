import { clsx } from 'clsx'
import { useT } from '@/i18n'

interface CompanyTypeBadgeProps {
  isExternal: boolean
  className?: string
}

export function CompanyTypeBadge({ isExternal, className }: CompanyTypeBadgeProps) {
  const t = useT()

  if (!isExternal) {
    return (
      <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/15 text-blue-400', className)}>
        Syncero Flow
      </span>
    )
  }

  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--bg-elevated)] text-[var(--text-muted)]', className)}>
      {t('nav_externalBadge')}
    </span>
  )
}
