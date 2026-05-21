import { useState } from 'react'
import { Mail } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/i18n'
import { Button, Card, Input, useToast } from '@syncero/ui'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M47.532 24.552c0-1.636-.142-3.2-.408-4.704H24.48v8.898h12.958c-.558 3.016-2.25 5.572-4.794 7.286v6.054h7.764c4.542-4.182 7.124-10.342 7.124-17.534z" fill="#4285F4"/>
      <path d="M24.48 48c6.498 0 11.952-2.154 15.934-5.836l-7.764-6.054c-2.154 1.446-4.908 2.298-8.17 2.298-6.282 0-11.604-4.242-13.506-9.942H2.934v6.246C6.898 42.696 15.128 48 24.48 48z" fill="#34A853"/>
      <path d="M10.974 28.466a14.41 14.41 0 0 1-.75-4.466c0-1.55.27-3.054.75-4.466v-6.246H2.934A23.946 23.946 0 0 0 .48 24c0 3.866.924 7.524 2.454 10.712l8.04-6.246z" fill="#FBBC05"/>
      <path d="M24.48 9.592c3.54 0 6.714 1.218 9.21 3.608l6.906-6.906C36.42 2.376 30.978 0 24.48 0 15.128 0 6.898 5.304 2.934 13.288l8.04 6.246c1.902-5.7 7.224-9.942 13.506-9.942z" fill="#EA4335"/>
    </svg>
  )
}

type Mode = 'signin' | 'signup' | 'reset'

export function Component() {
  const t = useT()
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuth()
  const toast = useToast()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError('')
    const { error: err } = await signInWithGoogle()
    if (err) {
      setError(t('login_error'))
      setLoading(false)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (mode === 'signup') {
      if (password.length < 6) { setError(t('login_passwordTooShort')); return }
      if (password !== passwordConfirm) { setError(t('login_passwordMismatch')); return }
    }

    setLoading(true)
    if (mode === 'signin') {
      const { error: err } = await signInWithEmail(email, password)
      if (err) { setError(t('login_emailError')); setLoading(false) }
    } else {
      const { error: err } = await signUpWithEmail(email, password)
      setLoading(false)
      if (err) {
        setError(t('login_emailSignUpError'))
      } else {
        setPendingEmail(email)
      }
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await resetPassword(email)
    setLoading(false)
    if (err) { setError(t('login_emailError')) } else { toast.success(t('login_resetSent')) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-[var(--accent)] flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl">SF</span>
          </div>
        </div>

        <Card>
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">{t('login_title')}</h1>
            <p className="text-sm text-[var(--text-muted)]">{t('login_subtitle')}</p>
          </div>

          {pendingEmail ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="h-12 w-12 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center">
                <Mail className="h-6 w-6 text-[var(--accent)]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">{t('login_confirmTitle')}</p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {t('login_confirmSent')} <span className="font-medium text-[var(--text-primary)]">{pendingEmail}</span>.<br />
                  {t('login_confirmAction')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setPendingEmail(''); setMode('signin') }}
                className="text-xs text-[var(--accent)] hover:underline cursor-pointer"
              >
                {t('login_backToLogin')}
              </button>
            </div>
          ) : (
            <>
          {mode !== 'reset' && (
            <div className="flex rounded-[var(--radius-md)] bg-[var(--bg-elevated)] p-1 mb-6 gap-1">
              {(['signin', 'signup'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError('') }}
                  className={`flex-1 text-sm font-medium py-1.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
                    mode === m
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {m === 'signin' ? t('login_tabSignIn') : t('login_tabSignUp')}
                </button>
              ))}
            </div>
          )}

          {error && (
            <p className="text-xs text-center mb-4 text-[var(--danger)]">{error}</p>
          )}

          {mode === 'reset' ? (
            <form onSubmit={handleReset} className="flex flex-col gap-3">
              <p className="text-sm text-[var(--text-secondary)] text-center mb-2">{t('login_forgotPassword')}</p>
              <Input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('login_emailPlaceholder')}
              />
              <Button type="submit" loading={loading} className="w-full h-10 text-sm">
                {t('login_sendReset')}
              </Button>
              <button
                type="button"
                onClick={() => { setMode('signin'); setError('') }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
              >
                {t('login_backToLogin')}
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3 mb-4">
                <Input
                  label={t('login_email')}
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('login_emailPlaceholder')}
                />
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">{t('login_password')}</label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => { setMode('reset'); setError('') }}
                        className="text-xs text-[var(--accent)] hover:underline cursor-pointer"
                      >
                        {t('login_forgotPassword')}
                      </button>
                    )}
                  </div>
                  <Input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={t('login_passwordPlaceholder')}
                  />
                </div>
                {mode === 'signup' && (
                  <Input
                    label={t('login_passwordConfirm')}
                    type="password"
                    required
                    value={passwordConfirm}
                    onChange={e => setPasswordConfirm(e.target.value)}
                    placeholder={t('login_passwordPlaceholder')}
                  />
                )}
                <Button type="submit" loading={loading} className="w-full h-10 text-sm mt-1">
                  {mode === 'signin' ? t('login_signIn') : t('login_signUp')}
                </Button>
              </form>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-[var(--bg-border)]" />
                <span className="text-xs text-[var(--text-muted)]">{t('login_or')}</span>
                <div className="flex-1 h-px bg-[var(--bg-border)]" />
              </div>

              <Button
                onClick={handleGoogleLogin}
                loading={loading}
                variant="ghost"
                className="w-full gap-3 h-11 text-sm font-medium"
              >
                {!loading && <GoogleIcon />}
                {t('login_google')}
              </Button>
            </>
          )}

          </>
          )}

          {!pendingEmail && (
            <p className="text-xs text-[var(--text-muted)] text-center mt-6 leading-relaxed">
              {t('login_terms')}
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
