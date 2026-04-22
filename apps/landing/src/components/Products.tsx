import { ArrowRight, BookOpen, CheckCircle, TrendingUp } from 'lucide-react'
import { useT } from '../i18n'

const FLOW_URL  = import.meta.env.VITE_FLOW_URL  as string
const BOOKS_URL = import.meta.env.VITE_BOOKS_URL as string

export function Products() {
  const t = useT()

  return (
    <section id="produtos" className="py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-4">
            {t('products_h2')}
          </h2>
          <p className="text-[var(--text-secondary)] max-w-lg mx-auto">
            {t('products_sub')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">

          {/* Syncero Flow */}
          <div className="relative group flex flex-col rounded-[var(--radius-xl)] border border-[var(--bg-border)] bg-[var(--bg-surface)] p-8 overflow-hidden hover:border-[var(--accent)]/50 transition-colors">
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse, #3b82f6 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />

            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-[var(--accent)]" />
              </div>
              <div>
                <h3 className="font-bold text-[var(--text-primary)] text-lg">Syncero Flow</h3>
                <p className="text-xs text-[var(--accent)]">{t('flow_tagline')}</p>
              </div>
            </div>

            <p className="text-2xl font-semibold text-[var(--text-primary)] mb-2 italic">{t('flow_quote')}</p>
            <p className="text-[var(--text-secondary)] text-sm mb-8 leading-relaxed">{t('flow_desc')}</p>

            <ul className="space-y-3 mb-8 flex-1">
              {(['flow_f1','flow_f2','flow_f3','flow_f4','flow_f5'] as const).map((key) => (
                <li key={key} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
                  <CheckCircle className="h-4 w-4 text-[var(--accent)] flex-shrink-0" />
                  {t(key)}
                </li>
              ))}
            </ul>

            <a
              href={`${FLOW_URL}/login`}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {t('flow_btn')}
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          {/* Syncero Books */}
          <div className="relative group flex flex-col rounded-[var(--radius-xl)] border border-[var(--bg-border)] bg-[var(--bg-surface)] p-8 overflow-hidden hover:border-[var(--success)]/50 transition-colors">
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse, #10b981 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />

            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-xl bg-[#0d2a1e] flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-[var(--success)]" />
              </div>
              <div>
                <h3 className="font-bold text-[var(--text-primary)] text-lg">Syncero Books</h3>
                <p className="text-xs text-[var(--success)]">{t('books_tagline')}</p>
              </div>
            </div>

            <p className="text-2xl font-semibold text-[var(--text-primary)] mb-2 italic">{t('books_quote')}</p>
            <p className="text-[var(--text-secondary)] text-sm mb-8 leading-relaxed">{t('books_desc')}</p>

            <ul className="space-y-3 mb-8 flex-1">
              {(['books_f1','books_f2','books_f3','books_f4','books_f5'] as const).map((key) => (
                <li key={key} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
                  <CheckCircle className="h-4 w-4 text-[var(--success)] flex-shrink-0" />
                  {t(key)}
                </li>
              ))}
            </ul>

            <a
              href={`${BOOKS_URL}/login`}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--success)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {t('books_btn')}
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
