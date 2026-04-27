import { CheckCircle } from 'lucide-react'
import { useT } from '@/i18n'

interface PaymentPromptStepProps {
  onRegisterPayment: () => void
  onSkip: () => void
  skipCountdown: number
}

export function PaymentPromptStep({ onRegisterPayment, onSkip, skipCountdown }: PaymentPromptStepProps) {
  const t = useT()

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <div className="flex items-center justify-center h-14 w-14 rounded-full bg-[var(--success)]/10">
        <CheckCircle className="h-7 w-7 text-[var(--success)]" />
      </div>
      <div className="text-center">
        <p className="text-base font-medium text-[var(--text-primary)]">
          {t('transactions_payment_promptTitle')}
        </p>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {t('transactions_payment_promptSubtitle')}
        </p>
      </div>
      <div className="flex items-center justify-between w-full mt-6 pt-4 border-t border-[var(--bg-border)]">
        <button
          type="button"
          onClick={onSkip}
          className="group relative h-8 overflow-hidden rounded-[var(--radius-md)] px-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 rounded-[inherit] bg-[var(--bg-elevated)] group-hover:bg-[var(--bg-border)] transition-[width,background-color] ease-linear"
            style={{
              width: `${((5 - skipCountdown) / 5) * 100}%`,
              transitionDuration: `1000ms, 50ms`,
            }}
          />
          <span className="relative z-10 flex items-center gap-1.5">
            {t('transactions_payment_skip')}
            <span className="font-mono text-xs opacity-50">{skipCountdown}s</span>
          </span>
        </button>
        <button
          onClick={onRegisterPayment}
          className="px-4 py-2 bg-[var(--accent)] text-white rounded-[var(--radius-md)] hover:opacity-90 transition-opacity"
        >
          {t('transactions_payment_register')}
        </button>
      </div>
    </div>
  )
}