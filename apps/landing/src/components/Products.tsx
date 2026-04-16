import { ArrowRight, BookOpen, CheckCircle, TrendingUp } from "lucide-react";

export function Products({ onLogin }: { onLogin: () => void }) {
  return (
    <section id="produtos" className="py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-4">
            Um ecossistema completo
          </h2>
          <p className="text-[var(--text-secondary)] max-w-lg mx-auto">
            Dois produtos complementares que compartilham a mesma base de dados em tempo real.
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
                <p className="text-xs text-[var(--accent)]">Para empresários e gestores</p>
              </div>
            </div>

            <p className="text-2xl font-semibold text-[var(--text-primary)] mb-2 italic">
              "Seu financeiro em movimento."
            </p>
            <p className="text-[var(--text-secondary)] text-sm mb-8 leading-relaxed">
              Controle financeiro operacional do dia a dia. Lançamentos rápidos, fluxo de caixa e gestão de contas — tudo em uma interface minimalista e mobile-first.
            </p>

            <ul className="space-y-3 mb-8 flex-1">
              {[
                'Lançamentos de entradas e saídas',
                'Controle de fluxo de caixa',
                'Gestão de contas a pagar e receber',
                'DRE e relatórios financeiros',
                'Convide seu contador direto pelo app',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
                  <CheckCircle className="h-4 w-4 text-[var(--accent)] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={onLogin}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
            >
              Acessar Syncero Flow
              <ArrowRight className="h-4 w-4" />
            </button>
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
                <p className="text-xs text-[var(--success)]">Para contadores e auditores</p>
              </div>
            </div>

            <p className="text-2xl font-semibold text-[var(--text-primary)] mb-2 italic">
              "Contabilidade estratégica em tempo real."
            </p>
            <p className="text-[var(--text-secondary)] text-sm mb-8 leading-relaxed">
              Inteligência e auditoria contábil com rigor e precisão. Valide o que o empresário lança sem redigitação — elimine planilhas e e-mails da sua rotina.
            </p>

            <ul className="space-y-3 mb-8 flex-1">
              {[
                'Auditoria de lançamentos do Syncero Flow',
                'Conciliação bancária',
                'Geração de DRE e Balanço',
                'Integração com sistemas governamentais',
                'Gestão de múltiplas empresas clientes',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
                  <CheckCircle className="h-4 w-4 text-[var(--success)] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={onLogin}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--success)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
            >
              Acessar Syncero Books
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}