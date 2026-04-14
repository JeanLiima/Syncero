import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
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
import { supabase } from './lib/supabase'

const FLOW_URL  = 'https://syncero-flow.vercel.app'
const BOOKS_URL = 'https://syncero-books.vercel.app'

type UserType = 'company_user' | 'accountant'

function redirectWithSession(session: Session, type: UserType) {
  const base = type === 'accountant' ? BOOKS_URL : FLOW_URL
  const hash = new URLSearchParams({
    access_token:  session.access_token,
    refresh_token: session.refresh_token ?? '',
    token_type:    'bearer',
    expires_in:    String(session.expires_in ?? 3600),
    type:          'login',
  })
  window.location.replace(`${base}#${hash.toString()}`)
}

// ── Login Modal ───────────────────────────────────────────────

function LoginModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode]                   = useState<'login' | 'onboarding'>('login')
  const [email, setEmail]                 = useState('')
  const [password, setPassword]           = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [pendingSession, setPendingSession] = useState<Session | null>(null)
  const [userType, setUserType]           = useState<UserType | null>(null)
  const [onboardingLoading, setOnboardingLoading] = useState(false)

  // Capture OAuth callback when Supabase redirects back to landing
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) await checkProfileAndRedirect(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function checkProfileAndRedirect(session: Session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', session.user.id)
      .single()

    if (!profile) {
      setPendingSession(session)
      setMode('onboarding')
      setLoading(false)
      return
    }
    redirectWithSession(session, profile.user_type as UserType)
  }

  const handleGoogle = async () => {
    setLoading(true)
    setError(null)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: import.meta.env.VITE_APP_URL ?? window.location.origin },
    })
  }

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data: { session }, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err || !session) {
      setError(err?.message ?? 'Erro ao entrar. Verifique seu e-mail e senha.')
      setLoading(false)
      return
    }
    await checkProfileAndRedirect(session)
  }

  const handleOnboarding = async () => {
    if (!userType || !pendingSession) return
    setOnboardingLoading(true)
    const u = pendingSession.user
    const { error: err } = await supabase.from('profiles').upsert({
      id:        u.id,
      full_name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email?.split('@')[0] ?? 'Usuário',
      email:     u.email ?? '',
      user_type: userType,
      avatar_url: u.user_metadata?.avatar_url ?? u.user_metadata?.picture ?? null,
    }, { onConflict: 'id' })
    if (err) {
      setError(err.message)
      setOnboardingLoading(false)
      return
    }
    redirectWithSession(pendingSession, userType)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-md bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded-[var(--radius-xl)] p-8 shadow-2xl"
        style={{ animation: 'fadeUp .2s ease' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="h-10 w-10 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-white font-bold text-base">S</span>
          </div>
        </div>

        {mode === 'onboarding' ? (
          /* ── Onboarding step ── */
          <>
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">Como você vai usar a plataforma?</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">Essa informação define qual produto você vai acessar</p>
            </div>

            <div className="flex flex-col gap-3 mb-6">
              {([
                { value: 'company_user' as UserType, label: 'Sou Empresa', sub: 'Syncero Flow — gestão financeira', icon: <Building2 className="h-6 w-6" />, accent: 'var(--accent)', bg: 'var(--accent-subtle)' },
                { value: 'accountant'   as UserType, label: 'Sou Contador',  sub: 'Syncero Books — acesso fiscal',   icon: <Calculator  className="h-6 w-6" />, accent: 'var(--success)', bg: '#0d2a1e' },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setUserType(opt.value)}
                  className={`flex items-center gap-4 p-4 rounded-[var(--radius-md)] border text-left transition-all cursor-pointer ${
                    userType === opt.value
                      ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                      : 'border-[var(--bg-border)] hover:border-[var(--text-muted)] bg-[var(--bg-elevated)]'
                  }`}
                >
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: opt.bg, color: opt.accent }}>
                    {opt.icon}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-[var(--text-primary)]">{opt.label}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{opt.sub}</p>
                  </div>
                </button>
              ))}
            </div>

            {error && <p className="text-xs text-[var(--danger)] mb-4 text-center">{error}</p>}

            <button
              onClick={handleOnboarding}
              disabled={!userType || onboardingLoading}
              className="w-full h-10 rounded-[var(--radius-md)] bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
            >
              {onboardingLoading ? 'Redirecionando...' : 'Continuar'}
            </button>
          </>
        ) : (
          /* ── Login step ── */
          <>
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">Entrar no Syncero</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">Acesse o produto certo para o seu perfil</p>
            </div>

            {/* Google */}
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 h-10 px-4 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--bg-border)] transition-colors disabled:opacity-50 cursor-pointer mb-4"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Entrar com Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-[var(--bg-border)]" />
              <span className="text-xs text-[var(--text-muted)]">ou</span>
              <div className="flex-1 h-px bg-[var(--bg-border)]" />
            </div>

            {/* Email/password */}
            <form onSubmit={handleEmail} className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 px-3 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
              <input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 px-3 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
              {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="h-10 rounded-[var(--radius-md)] bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </>
        )}
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
