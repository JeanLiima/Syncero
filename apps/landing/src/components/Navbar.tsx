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
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLang('pt')}
              title="Português"
              className={`text-lg leading-none transition-opacity cursor-pointer ${lang === 'pt' ? 'opacity-100' : 'opacity-30 hover:opacity-60'}`}
            >
              🇧🇷
            </button>
            <button
              onClick={() => setLang('en')}
              title="English"
              className={`text-lg leading-none transition-opacity cursor-pointer ${lang === 'en' ? 'opacity-100' : 'opacity-30 hover:opacity-60'}`}
            >
              🇺🇸
            </button>
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
