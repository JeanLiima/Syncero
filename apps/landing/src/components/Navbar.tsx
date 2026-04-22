import { ArrowRight } from 'lucide-react'
import { useLang, useT } from '../i18n'

export function Navbar({ onLogin }: { onLogin: () => void }) {
  const t = useT()
  const [lang, setLang] = useLang()

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b border-[var(--bg-border)]/60 bg-[var(--bg-base)]/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[var(--accent)] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="font-semibold text-[var(--text-primary)] text-lg tracking-tight">Syncero</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Language selector */}
          <div className="flex items-center rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-elevated)] overflow-hidden">
            {(['pt', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                title={l === 'pt' ? 'Português' : 'English'}
                className={`flex items-center gap-1.5 px-3 h-9 text-sm cursor-pointer transition-colors ${
                  lang === l
                    ? 'bg-[var(--bg-border)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-border)]/50'
                }`}
              >
                <span className="text-base leading-none">{l === 'pt' ? '🇧🇷' : '🇺🇸'}</span>
                <span className="text-xs font-medium uppercase tracking-wide">{l === 'pt' ? 'PT' : 'EN'}</span>
              </button>
            ))}
          </div>

          <button
            onClick={onLogin}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
          >
            {t('navbar_enter')}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  )
}
