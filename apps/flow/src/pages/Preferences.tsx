import { clsx } from 'clsx'
import { usePreferencesStore, type Language } from '@/store/preferences'
import { useT } from '@/i18n'
import { Card } from '@/components/ui'

const options: { value: Language; flag: string; code: string }[] = [
  { value: 'pt', flag: '🇧🇷', code: 'PT' },
  { value: 'en', flag: '🇺🇸', code: 'EN' },
]

export function Component() {
  const t = useT()
  const { language, setLanguage } = usePreferencesStore()

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('preferences_title')}</h1>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">{t('preferences_language')}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('preferences_languageHint')}</p>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border border-[var(--bg-border)]">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLanguage(opt.value)}
                className={clsx(
                  'cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-all',
                  language === opt.value
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-border)]'
                )}
              >
                <span>{opt.flag}</span>
                <span>{opt.code}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
