import { Link2, RefreshCw, Shield, Zap } from "lucide-react"

const pillars = [
  {
    icon: <Link2 className="h-6 w-6 text-[var(--accent)]" />,
    title: 'Ponte Digital',
    desc: 'Elimine e-mails, PDFs soltos e planilhas para troca de informações contábeis. Tudo centralizado em uma plataforma.',
    color: 'var(--accent-subtle)',
  },
  {
    icon: <RefreshCw className="h-6 w-6 text-[var(--success)]" />,
    title: 'Sincronia em Tempo Real',
    desc: 'O dado lançado pelo empresário no Flow fica imediatamente disponível para revisão contábil no Books.',
    color: '#0d2a1e',
  },
  {
    icon: <Zap className="h-6 w-6 text-[var(--warning)]" />,
    title: 'Fricção Zero',
    desc: 'Como PWA, o acesso é instantâneo via navegador com experiência de app nativo, sem instalação.',
    color: '#1f1a0d',
  },
  {
    icon: <Shield className="h-6 w-6 text-[var(--danger)]" />,
    title: 'Integridade de Dados',
    desc: 'Cada transação é rastreável e segura. A integridade do seu ledger financeiro é a prioridade máxima.',
    color: '#2a0d14',
  },
]

export function Pillars() {
  return (
    <section className="py-24 px-4 sm:px-6 border-t border-[var(--bg-border)]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-4">
            Construído sobre pilares sólidos
          </h2>
          <p className="text-[var(--text-secondary)] max-w-lg mx-auto">
            Princípios que guiam cada decisão de produto no ecossistema Syncero.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="flex flex-col gap-4 p-6 rounded-[var(--radius-lg)] border border-[var(--bg-border)] bg-[var(--bg-surface)] hover:border-[var(--bg-border)]/80 transition-colors"
            >
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center"
                style={{ background: p.color }}
              >
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