import { type ReactNode } from 'react'
import { Info, CheckCircle2, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'

type Variant = 'info' | 'success' | 'warning' | 'danger'

interface AlertBoxProps {
  variant?: Variant
  icon?: ReactNode
  children: ReactNode
  className?: string
}

const STYLES: Record<Variant, { bg: string; border: string; icon: string; DefaultIcon: React.ElementType }> = {
  info:    { bg: 'bg-[var(--accent)]/10',  border: 'border-[var(--accent)]/20',  icon: 'text-[var(--accent)]',  DefaultIcon: Info           },
  success: { bg: 'bg-[var(--success)]/10', border: 'border-[var(--success)]/30', icon: 'text-[var(--success)]', DefaultIcon: CheckCircle2   },
  warning: { bg: 'bg-[var(--warning)]/10', border: 'border-[var(--warning)]/30', icon: 'text-[var(--warning)]', DefaultIcon: AlertCircle    },
  danger:  { bg: 'bg-[var(--danger)]/10',  border: 'border-[var(--danger)]/30',  icon: 'text-[var(--danger)]',  DefaultIcon: AlertCircle    },
}

export function AlertBox({ variant = 'warning', icon, children, className }: AlertBoxProps) {
  const { bg, border, icon: iconColor, DefaultIcon } = STYLES[variant]
  return (
    <div className={clsx('flex items-start gap-2.5 px-3 py-2.5 rounded-lg border', bg, border, className)}>
      <span className={clsx('shrink-0 mt-0.5', iconColor)}>
        {icon ?? <DefaultIcon className="h-4 w-4" />}
      </span>
      <div className="text-xs text-[var(--text-secondary)] min-w-0">{children}</div>
    </div>
  )
}
