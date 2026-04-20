import { useState  } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  X,
  Building2,
  Calculator,
  CheckCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const FLOW_URL  = import.meta.env.VITE_FLOW_URL;
const BOOKS_URL = import.meta.env.VITE_BOOKS_URL;

type UserType = 'company_user' | 'accountant'

// Cross-domain session transfer via hash — unavoidable when landing is the OAuth hub.
// The destination app's Supabase client (detectSessionInUrl: true) reads the hash
// and stores the session in its own localStorage automatically.
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

async function getProfileType(session: Session): Promise<UserType | null> {
  const { data } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', session.user.id)
    .single()
  return data ? (data.user_type as UserType) : null
}

// ── Login Modal ───────────────────────────────────────────────

export function LoginModal({
  onClose,
  callbackSession,
  initialMode = 'login',
}: {
  onClose: () => void
  callbackSession?: Session | null
  initialMode?: 'login' | 'register'
}) {
  const [mode, setMode]         = useState<'login' | 'register' | 'onboarding' | 'email_sent'>(
    callbackSession ? 'onboarding' : initialMode
  )
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [pendingSession, setPendingSession] = useState<Session | null>(callbackSession ?? null)
  const [userType, setUserType] = useState<UserType | null>(null)
  const [onboardingLoading, setOnboardingLoading] = useState(false)

  async function checkProfileAndRedirect(session: Session) {
    const type = await getProfileType(session)
    if (!type) {
      setPendingSession(session)
      setMode('onboarding')
      setLoading(false)
      return
    }
    redirectWithSession(session, type)
  }

  const handleGoogle = async () => {
    setLoading(true)
    setError(null)
    // OAuth retorna para a landing (VITE_LANDING_URL); landing verifica o tipo
    // de perfil e redireciona para o app correto com a hash de sessão.
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: import.meta.env.VITE_LANDING_URL ?? window.location.origin },
    })
    if (err) {
      setError(err?.message ?? 'Erro ao entrar. Verifique seu e-mail e senha.')
      setLoading(false)
    }
    // await checkProfileAndRedirect(session)
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data: { session, user }, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    if (session) {
      await checkProfileAndRedirect(session)
    } else if (user) {
      setMode('email_sent')
      setLoading(false)
    }
  }

  const handleOnboarding = async () => {
    if (!userType || !pendingSession) return
    setOnboardingLoading(true)
    const u = pendingSession.user
    const { error: err } = await supabase.from('profiles').upsert({
      id:         u.id,
      full_name:  u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email?.split('@')[0] ?? 'Usuário',
      email:      u.email ?? '',
      user_type:  userType,
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
          /* ── Onboarding — escolha de perfil após primeiro login ── */
          <>
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">Como você vai usar a plataforma?</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">Isso define qual produto você vai acessar</p>
            </div>

            <div className="flex flex-col gap-3 mb-6">
              {([
                { value: 'company_user' as UserType, label: 'Sou Empresa',  sub: 'Syncero Flow — gestão financeira', icon: <Building2 className="h-6 w-6" />, accent: 'var(--accent)', bg: 'var(--accent-subtle)' },
                { value: 'accountant'   as UserType, label: 'Sou Contador', sub: 'Syncero Books — acesso fiscal',    icon: <Calculator  className="h-6 w-6" />, accent: 'var(--success)', bg: '#0d2a1e' },
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
        ) : mode === 'register' ? (
          /* ── Register ── */
          <>
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">Criar conta no Syncero</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">Comece gratuitamente, sem cartão de crédito</p>
            </div>

            {/* Google SSO */}
            <button
              type="button"
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
              Criar conta com Google
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-[var(--bg-border)]" />
              <span className="text-xs text-[var(--text-muted)]">ou</span>
              <div className="flex-1 h-px bg-[var(--bg-border)]" />
            </div>

            <form onSubmit={handleRegister} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-10 px-3 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
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
                {loading ? 'Criando conta...' : 'Criar conta'}
              </button>
            </form>

            <p className="text-xs text-center text-[var(--text-muted)] mt-4">
              Já tem conta?{' '}
              <button onClick={() => setMode('login')} className="text-[var(--accent)] hover:underline cursor-pointer bg-transparent border-none p-0">
                Entrar
              </button>
            </p>
          </>
        ) : mode === 'email_sent' ? (
          /* ── Email confirmation sent ── */
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="h-12 w-12 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-[var(--accent)]" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Verifique seu e-mail</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Enviamos um link de confirmação para{' '}
              <strong className="text-[var(--text-primary)]">{email}</strong>.
              Clique no link para ativar sua conta.
            </p>
            <button
              onClick={() => setMode('login')}
              className="mt-6 text-xs text-[var(--accent)] hover:underline cursor-pointer bg-transparent border-none p-0"
            >
              Voltar ao login
            </button>
          </div>
        ) : (
          /* ── Login ── */
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

            <p className="text-xs text-center text-[var(--text-muted)] mt-4">
              Não tem conta?{' '}
              <button onClick={() => setMode('register')} className="text-[var(--accent)] hover:underline cursor-pointer bg-transparent border-none p-0">
                Criar conta
              </button>
            </p>
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