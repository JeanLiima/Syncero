import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button, Card, Spinner } from '@/components/ui'

type InviteStatus = 'loading' | 'ready' | 'error' | 'success'

export function Component() {
  const { token } = useParams<{ token: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState<InviteStatus>('loading')
  const [message, setMessage] = useState('')
  const [inviteType, setInviteType] = useState<'member' | 'accountant' | null>(null)
  const [companyName, setCompanyName] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Token de convite inválido.'); return }
    resolveInvite()
  }, [token])

  const resolveInvite = async () => {
    // Check accountant_companies first
    const { data: acct } = await supabase
      .from('accountant_companies')
      .select('id, status, companies(name)')
      .eq('invite_token', token)
      .maybeSingle()

    if (acct) {
      setInviteType('accountant')
      const company = acct.companies as unknown as { name: string } | null
      setCompanyName(company?.name ?? '')
      if (acct.status !== 'pending') {
        setStatus('error')
        setMessage('Este convite já foi utilizado ou expirou.')
      } else {
        setStatus('ready')
      }
      return
    }

    // Check company_members
    const { data: member } = await supabase
      .from('company_members')
      .select('id, status, companies(name)')
      .eq('invite_token', token)
      .maybeSingle()

    if (member) {
      setInviteType('member')
      const company = member.companies as unknown as { name: string } | null
      setCompanyName(company?.name ?? '')
      if (member.status !== 'pending') {
        setStatus('error')
        setMessage('Este convite já foi utilizado ou expirou.')
      } else {
        setStatus('ready')
      }
      return
    }

    setStatus('error')
    setMessage('Convite não encontrado.')
  }

  const acceptInvite = async () => {
    if (!user) {
      // Inicia Google OAuth e retorna para esta página do convite após o login
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href },
      })
      return
    }

    setStatus('loading')

    let error: { message: string } | null = null

    if (inviteType === 'accountant') {
      const { error: e } = await supabase
        .from('accountant_companies')
        .update({ status: 'accepted', accountant_id: user.id })
        .eq('invite_token', token)
      error = e
    } else {
      const { error: e } = await supabase
        .from('company_members')
        .update({ status: 'active', user_id: user.id })
        .eq('invite_token', token)
      error = e
    }

    if (error) {
      setStatus('error')
      setMessage('Erro ao aceitar convite. Tente novamente.')
    } else {
      setStatus('success')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-[var(--accent)] flex items-center justify-center">
            <span className="text-white font-bold text-lg">SF</span>
          </div>
        </div>

        <Card>
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Spinner size="lg" />
              <p className="text-sm text-[var(--text-muted)]">Verificando convite…</p>
            </div>
          )}

          {status === 'ready' && (
            <>
              <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Convite recebido</h1>
              <p className="text-sm text-[var(--text-secondary)] mb-6">
                Você foi convidado para{' '}
                {inviteType === 'accountant' ? 'acessar como contador' : 'participar'} da empresa{' '}
                <strong className="text-[var(--text-primary)]">{companyName}</strong>.
              </p>
              {!user && (
                <p className="text-xs text-[var(--warning)] mb-4">
                  Você precisa estar logado para aceitar o convite.
                </p>
              )}
              <Button onClick={acceptInvite} className="w-full">
                {user ? 'Aceitar convite' : 'Fazer login para aceitar'}
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <h1 className="text-xl font-semibold text-[var(--danger)] mb-2">Convite inválido</h1>
              <p className="text-sm text-[var(--text-secondary)] mb-6">{message}</p>
              <Button variant="ghost" onClick={() => navigate('/')} className="w-full">
                Ir para o início
              </Button>
            </>
          )}

          {status === 'success' && (
            <>
              <h1 className="text-xl font-semibold text-[var(--success)] mb-2">Convite aceito!</h1>
              <p className="text-sm text-[var(--text-secondary)] mb-6">
                Você agora tem acesso à empresa <strong>{companyName}</strong>.
              </p>
              <Button onClick={() => navigate('/')} className="w-full">
                Acessar painel
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
