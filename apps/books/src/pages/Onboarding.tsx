import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/i18n'

// Users arriving in Books without a profile are auto-assigned as accountant.
// This should rarely happen in production since the landing handles onboarding.
export function Component() {
  const t = useT()
  const { createProfile } = useAuth()

  useEffect(() => {
    createProfile('accountant')
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
      <div className="text-center">
        <div className="h-8 w-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-[var(--text-secondary)]">{t('onboarding_loading')}</p>
      </div>
    </div>
  )
}
