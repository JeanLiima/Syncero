import { ArrowRight } from 'lucide-react'
import { useT } from '../i18n'

export function Hero({ onLogin }: { onLogin: () => void }) {
  const t = useT()

  return (
    <section className="pt-40 pb-28 px-4 sm:px-6 text-center relative overflow-hidden">
      {/* Glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, #3b82f6 0%, transparent 70%)' }}
      />

      <div className="relative max-w-3xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--bg-border)] bg-[var(--bg-elevated)] text-xs text-[var(--text-secondary)] mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)] animate-pulse" />
          {t('hero_badge')}
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-[var(--text-primary)] leading-tight mb-6">
          {t('hero_h1_1')}<br />
          <span className="text-[var(--accent)]">{t('hero_h1_2')}</span>
        </h1>

        <p className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto mb-10 leading-relaxed">
          {t('hero_p')}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onLogin}
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-[var(--radius-md)] bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity cursor-pointer text-sm"
          >
            {t('hero_cta')}
            <ArrowRight className="h-4 w-4" />
          </button>
          <a
            href="#produtos"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors text-sm"
          >
            {t('hero_learn')}
          </a>
        </div>
      </div>
    </section>
  )
}
