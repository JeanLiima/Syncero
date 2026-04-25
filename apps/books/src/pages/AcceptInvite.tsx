import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/i18n'
import { Button, Card, Spinner } from '@syncero/ui'

type InviteStatus = 'loading' | 'ready' | 'error' | 'success'

export function Component() {
  const { token } = useParams<{ token: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  const [status, setStatus] = useState<InviteStatus>('loading')
  const [message, setMessage] = useState('')
  const [companyName, setCompanyName] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage(t('invite_errorInvalid')); return }
    resolveInvite()
  }, [token])

  const resolveInvite = async () => {
    try {
      const data = await fetch(`/api/invites/${token}`).then(r => r.json()) as
        | { type: 'accountant'; companyName: string; status: string }
        | { error: string }

      if ('error' in data) {
        setStatus('error')
        setMessage(t('invite_errorNotFound'))
        return
      }

      setCompanyName(data.companyName)
      if (data.status !== 'pending') {
        setStatus('error')
        setMessage(t('invite_errorExpired'))
      } else {
        setStatus('ready')
      }
    } catch {
      setStatus('error')
      setMessage(t('invite_errorVerify'))
    }
  }

  const acceptInvite = async () => {
    if (!user) {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href },
      })
      return
    }

    setStatus('loading')
    try {
      await apiFetch(`/api/invites/${token}/accept`, { method: 'POST', body: '{}' })
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setMessage((err as Error)?.message || t('invite_errorAccept'))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
        </div>

        <Card>
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Spinner size="lg" />
              <p className="text-sm text-[var(--text-muted)]">{t('invite_verifying')}</p>
            </div>
          )}

          {status === 'ready' && (
            <>
              <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">{t('invite_received')}</h1>
              <p className="text-sm text-[var(--text-secondary)] mb-6">
                {t('invite_asAccountant_of')}{' '}
                <strong className="text-[var(--text-primary)]">{companyName}</strong>.
              </p>
              {!user && (
                <p className="text-xs text-[var(--warning)] mb-4">
                  {t('invite_loginRequired')}
                </p>
              )}
              <Button onClick={acceptInvite} className="w-full">
                {user ? t('invite_accept') : t('invite_loginToAccept')}
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <h1 className="text-xl font-semibold text-[var(--danger)] mb-2">{t('invite_invalid')}</h1>
              <p className="text-sm text-[var(--text-secondary)] mb-6">{message}</p>
              <Button variant="ghost" onClick={() => navigate('/')} className="w-full">
                {t('invite_gotoHome')}
              </Button>
            </>
          )}

          {status === 'success' && (
            <>
              <h1 className="text-xl font-semibold text-[var(--success)] mb-2">{t('invite_success')}</h1>
              <p className="text-sm text-[var(--text-secondary)] mb-6">
                {t('invite_accessGranted')} <strong>{companyName}</strong>.
              </p>
              <Button onClick={() => navigate('/')} className="w-full">
                {t('invite_gotoDashboard')}
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
