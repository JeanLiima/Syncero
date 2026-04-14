import { clsx } from 'clsx'
import { usePreferencesStore, type Language } from '@/store/preferences'
import { useT } from '@/i18n'
import { Card } from '@/components/ui'

interface LangOption {
  value: Language
  flag: string
  label: string
  labelKey: 'preferences_portuguese' | 'preferences_english'
}

const options: LangOption[] = [
  { value: 'pt', flag: '🇧🇷', label: 'Português', labelKey: 'preferences_portuguese' },
  { value: 'en', flag: '🇺🇸', label: 'English',   labelKey: 'preferences_english' },
]

export function Component() {
  const t = useT()
  const { language, setLanguage } = usePreferencesStore()

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('preferences_title')}</h1>

      <Card>
        <p className="text-sm font-medium text-[var(--text-primary)] mb-1">{t('preferences_language')}</p>
        <p className="text-xs text-[var(--text-secondary)] mb-4">{t('preferences_languageHint')}</p>

        <div className="flex flex-col gap-2">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setLanguage(opt.value)}
              className={clsx(
                'cursor-pointer flex items-center gap-3 p-3 rounded-[var(--radius-md)] border text-left transition-all',
                language === opt.value
                  ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                  : 'border-[var(--bg-border)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'
              )}
            >
              <span className="text-xl">{opt.flag}</span>
              <span className={clsx(
                'text-sm font-medium',
                language === opt.value ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
              )}>
                {t(opt.labelKey)}
              </span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}
