import { BookOpen, TrendingUp } from 'lucide-react'
import { useT } from '../i18n'

export function Comparison() {
  const t = useT()

  const rows = [
    { label: t('cmp_label1'), flow: t('cmp_flow1'), books: t('cmp_books1') },
    { label: t('cmp_label2'), flow: t('cmp_flow2'), books: t('cmp_books2') },
    { label: t('cmp_label3'), flow: t('cmp_flow3'), books: t('cmp_books3') },
    { label: t('cmp_label4'), flow: t('cmp_flow4'), books: t('cmp_books4') },
  ]

  return (
    <section className="py-24 px-4 sm:px-6 border-t border-[var(--bg-border)]">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-4">{t('comparison_h2')}</h2>
          <p className="text-[var(--text-secondary)]">{t('comparison_sub')}</p>
        </div>

        <div className="rounded-[var(--radius-xl)] border border-[var(--bg-border)] overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-3 bg-[var(--bg-elevated)]">
            <div className="px-5 py-4" />
            <div className="px-5 py-4 text-center border-l border-[var(--bg-border)]">
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="h-4 w-4 text-[var(--accent)]" />
                <span className="font-semibold text-[var(--text-primary)] text-sm">Flow</span>
              </div>
            </div>
            <div className="px-5 py-4 text-center border-l border-[var(--bg-border)]">
              <div className="flex items-center justify-center gap-2">
                <BookOpen className="h-4 w-4 text-[var(--books)]" />
                <span className="font-semibold text-[var(--text-primary)] text-sm">Books</span>
              </div>
            </div>
          </div>

          {/* Rows */}
          {rows.map((r, i) => (
            <div
              key={r.label}
              className={`grid grid-cols-3 border-t border-[var(--bg-border)] ${i % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-base)]'}`}
            >
              <div className="px-5 py-4 text-sm text-[var(--text-muted)] font-medium">{r.label}</div>
              <div className="px-5 py-4 text-sm text-[var(--text-secondary)] border-l border-[var(--bg-border)] text-center">{r.flow}</div>
              <div className="px-5 py-4 text-sm text-[var(--text-secondary)] border-l border-[var(--bg-border)] text-center">{r.books}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
