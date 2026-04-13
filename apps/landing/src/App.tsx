import { useState } from 'react'
import {
  ArrowRight,
  TrendingUp,
  BookOpen,
  Zap,
  Link2,
  RefreshCw,
  Shield,
  X,
  Building2,
  Calculator,
  CheckCircle,
} from 'lucide-react'

const FLOW_URL  = 'https://syncero-flow.vercel.app/login'
const BOOKS_URL = 'https://syncero-books.vercel.app/login'

// ── Login Modal ───────────────────────────────────────────────

function LoginModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded-[var(--radius-xl)] p-8 shadow-2xl"
        style={{ animation: 'fadeUp .2s ease' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="font-semibold text-[var(--text-primary)]">Syncero</span>
          </div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Como você quer entrar?</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Escolha o produto certo para o seu perfil</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Empresa */}
          <a
            href={FLOW_URL}
            className="group flex flex-col items-center gap-3 p-6 rounded-[var(--radius-lg)] border border-[var(--bg-border)] bg-[var(--bg-elevated)] hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all cursor-pointer"
          >
            <div className="h-14 w-14 rounded-2xl bg-[var(--accent-subtle)] group-hover:bg-[var(--accent)] flex items-center justify-center transition-colors">
              <Building2 className="h-7 w-7 text-[var(--accent)] group-hover:text-white transition-colors" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-[var(--text-primary)] text-sm">Sou Empresa</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Syncero Flow</p>
            </div>
            <ArrowRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
          </a>

          {/* Contador */}
          <a
            href={BOOKS_URL}
            className="group flex flex-col items-center gap-3 p-6 rounded-[var(--radius-lg)] border border-[var(--bg-border)] bg-[var(--bg-elevated)] hover:border-[var(--success)] hover:bg-[#0d2a1e] transition-all cursor-pointer"
          >
            <div className="h-14 w-14 rounded-2xl bg-[#0d2a1e] group-hover:bg-[var(--success)] flex items-center justify-center transition-colors">
              <Calculator className="h-7 w-7 text-[var(--success)] group-hover:text-white transition-colors" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-[var(--text-primary)] text-sm">Sou Contador</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Syncero Books</p>
            </div>
            <ArrowRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--success)] transition-colors" />
          </a>
        </div>

        <p className="text-center text-xs text-[var(--text-muted)] mt-6">
          Não tem conta? Acesse o produto desejado e crie a sua gratuitamente.
        </p>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ── Navbar ────────────────────────────────────────────────────

function Navbar({ onLogin }: { onLogin: () => void }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b border-[var(--bg-border)]/60 bg-[var(--bg-base)]/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[var(--accent)] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="font-semibold text-[var(--text-primary)] text-lg tracking-tight">Syncero</span>
        </div>
        <button
          onClick={onLogin}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
        >
          Entrar
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  )
}

// ── Hero ──────────────────────────────────────────────────────

function Hero({ onLogin }: { onLogin: () => void }) {
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
          Plataforma PWA — acesse de qualquer dispositivo
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-[var(--text-primary)] leading-tight mb-6">
          A verdade sincronizada<br />
          <span className="text-[var(--accent)]">dos seus números.</span>
        </h1>

        <p className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto mb-10 leading-relaxed">
          O elo entre o seu negócio e a sua contabilidade.
          Transparência financeira, de ponta a ponta — em tempo real.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onLogin}
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-[var(--radius-md)] bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity cursor-pointer text-sm"
          >
            Começar agora
            <ArrowRight className="h-4 w-4" />
          </button>
          <a
            href="#produtos"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors text-sm"
          >
            Conheça os produtos
          </a>
        </div>
      </div>
    </section>
  )
}

// ── Products ──────────────────────────────────────────────────

function Products() {
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

            <a
              href={FLOW_URL}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
            >
              Acessar Syncero Flow
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

            <a
              href={BOOKS_URL}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--success)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
            >
              Acessar Syncero Books
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Pillars ───────────────────────────────────────────────────

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

function Pillars() {
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

// ── Comparison Table ──────────────────────────────────────────

function Comparison() {
  const rows = [
    { label: 'Público-Alvo',      flow: 'Empresários e Gestores',    books: 'Contadores e Auditores' },
    { label: 'Foco Principal',    flow: 'Operação e Fluxo de Caixa', books: 'Conformidade e Relatórios' },
    { label: 'Interface',         flow: 'Minimalista e Mobile',      books: 'Analítica e Robusta' },
    { label: 'Ação Principal',    flow: 'Lançar e Gerir',            books: 'Validar e Reportar' },
  ]

  return (
    <section className="py-24 px-4 sm:px-6 border-t border-[var(--bg-border)]">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-4">Qual é o seu perfil?</h2>
          <p className="text-[var(--text-secondary)]">Cada produto foi desenhado para uma necessidade específica.</p>
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
                <BookOpen className="h-4 w-4 text-[var(--success)]" />
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

// ── CTA Section ───────────────────────────────────────────────

function CTA({ onLogin }: { onLogin: () => void }) {
  return (
    <section className="py-24 px-4 sm:px-6 border-t border-[var(--bg-border)]">
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-white font-bold text-base">S</span>
          </div>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-4">
          Pronto para sincronizar<br />seus números?
        </h2>
        <p className="text-[var(--text-secondary)] mb-10">
          Comece hoje. Sem cartão de crédito, sem complicação.
        </p>
        <button
          onClick={onLogin}
          className="inline-flex items-center gap-2 h-12 px-8 rounded-[var(--radius-md)] bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity cursor-pointer"
        >
          Criar conta gratuita
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-[var(--bg-border)] py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-[var(--accent)] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="text-sm text-[var(--text-muted)]">Syncero</span>
        </div>
        <div className="flex items-center gap-6">
          <a href={FLOW_URL}  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">Syncero Flow</a>
          <a href={BOOKS_URL} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">Syncero Books</a>
        </div>
        <p className="text-xs text-[var(--text-muted)]">© {new Date().getFullYear()} Syncero. Todos os direitos reservados.</p>
      </div>
    </footer>
  )
}

// ── App ───────────────────────────────────────────────────────

export default function App() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar onLogin={() => setModalOpen(true)} />
      <Hero    onLogin={() => setModalOpen(true)} />
      <Products />
      <Pillars />
      <Comparison />
      <CTA     onLogin={() => setModalOpen(true)} />
      <Footer />
      {modalOpen && <LoginModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}
