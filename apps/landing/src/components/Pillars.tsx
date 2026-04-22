import { Link2, RefreshCw, Shield, Zap } from 'lucide-react'
import { useT } from '../i18n'

export function Pillars() {
  const t = useT()

  const pillars = [
    { icon: <Link2    className="h-6 w-6 text-[var(--accent)]"   />, title: t('pillar1_title'), desc: t('pillar1_desc'), color: 'var(--accent-subtle)' },
    { icon: <RefreshCw className="h-6 w-6 text-[var(--success)]" />, title: t('pillar2_title'), desc: t('pillar2_desc'), color: '#0d2a1e' },
    { icon: <Zap      className="h-6 w-6 text-[var(--warning)]"  />, title: t('pillar3_title'), desc: t('pillar3_desc'), color: '#1f1a0d' },
    { icon: <Shield   className="h-6 w-6 text-[var(--danger)]"   />, title: t('pillar4_title'), desc: t('pillar4_desc'), color: '#2a0d14' },
  ]

  return (
    <section className="py-24 px-4 sm:px-6 border-t border-[var(--bg-border)]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-4">
            {t('pillars_h2')}
          </h2>
          <p className="text-[var(--text-secondary)] max-w-lg mx-auto">
            {t('pillars_sub')}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="flex flex-col gap-4 p-6 rounded-[var(--radius-lg)] border border-[var(--bg-border)] bg-[var(--bg-surface)] hover:border-[var(--bg-border)]/80 transition-colors"
            >
              <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: p.color }}>
                {p.icon}
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-1.5">{p.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
