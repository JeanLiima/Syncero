import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/i18n'
import { Button, Card } from '@/components/ui'

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

export function Component() {
  const t = useT()
  const { signInWithGoogle } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError('')
    const { error: err } = await signInWithGoogle()
    if (err) {
      setError('Não foi possível conectar com o Google. Tente novamente.')
      setLoading(false)
    }
    // Se OK, o Supabase redireciona — não há retorno
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-[var(--accent)] flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl">SF</span>
          </div>
        </div>

        <Card>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">Syncero Flow</h1>
            <p className="text-sm text-[var(--text-muted)]">{t('login_subtitle')}</p>
          </div>

          {error && (
            <p className="text-xs text-[var(--danger)] text-center mb-4">{error}</p>
          )}

          <Button
            onClick={handleGoogleLogin}
            loading={loading}
            variant="ghost"
            className="w-full gap-3 h-11 text-sm font-medium"
          >
            {!loading && <GoogleIcon />}
            {t('login_google')}
          </Button>

          <p className="text-xs text-[var(--text-muted)] text-center mt-6 leading-relaxed">
            Ao entrar, você concorda com os termos de uso.<br />
            Primeiro acesso? Sua conta será criada automaticamente.
          </p>
        </Card>
      </div>
    </div>
  )
}
