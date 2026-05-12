import { useEffect, useRef, useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { Button } from '@syncero/ui'
import { useT } from '@/i18n'
import type { TransactionType } from '@/types'

const SKIP_DURATION_MS = 5000

interface PaymentPromptStepProps {
  type: TransactionType
  onRegisterPayment: () => void
  onSkip: () => void
  skipCountdown: number
}

export function PaymentPromptStep({ type, onRegisterPayment, onSkip, skipCountdown }: PaymentPromptStepProps) {
  const t = useT()
  const isIncome = type === 'income'
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const start = performance.now()
    const tick = () => {
      const p = Math.min((performance.now() - start) / SKIP_DURATION_MS, 1)
      setProgress(p)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

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
            className="absolute inset-y-0 left-0 rounded-[inherit] bg-[var(--bg-elevated)] group-hover:bg-[var(--bg-border)] transition-[background-color] duration-50"
            style={{ width: `${progress * 100}%` }}
          />
          <span className="relative z-10 flex items-center gap-1.5">
            {t('transactions_payment_skip')}
            <span className="font-mono text-xs opacity-50">{skipCountdown}s</span>
          </span>
        </button>
        <Button onClick={onRegisterPayment}>
          {isIncome ? t('transactions_payment_registerIncome') : t('transactions_payment_register')}
        </Button>
      </div>
    </div>
  )
}
