import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Calculator } from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/i18n'
import { Button, Card, Avatar, useToast } from '@/components/ui'

type UserType = 'company_user' | 'accountant'

export function Component() {
  const t = useT()
  const { user, createProfile } = useAuth()
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()
  const [selected, setSelected] = useState<UserType | null>(null)
  const [loading, setLoading] = useState(false)

  const name =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split('@')[0] ??
    'Usuário'

  const avatarUrl: string | null =
    user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null

  const options = [
    {
      value: 'company_user' as UserType,
      label: t('onboarding_companyLabel'),
      description: t('onboarding_companyDesc'),
      icon: <Building2 className="h-7 w-7" />,
    },
    {
      value: 'accountant' as UserType,
      label: t('onboarding_accountantLabel'),
      description: t('onboarding_accountantDesc'),
      icon: <Calculator className="h-7 w-7" />,
    },
  ]

  const handleContinue = async () => {
    if (!selected) return
    setLoading(true)
    const { error: err } = await createProfile(selected)
    if (err) {
      toastError(err.message ?? 'Erro ao criar perfil. Tente novamente.')
      setLoading(false)
    } else {
      success('Perfil criado com sucesso!')
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-[var(--accent)] flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl">SB</span>
          </div>
        </div>

        <Card>
          {/* User greeting */}
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-[var(--bg-border)]">
            <Avatar name={name} src={avatarUrl} size="md" />
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Olá, {name.split(' ')[0]}!</p>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                {t('onboarding_welcome')} {t('onboarding_title')}
              </p>
            </div>
          </div>

          {/* Type selection */}
          <div className="flex flex-col gap-3 mb-6">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelected(opt.value)}
                className={clsx(
                  'cursor-pointer flex items-center gap-4 p-4 rounded-[var(--radius-md)] border text-left transition-all',
                  selected === opt.value
                    ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                    : 'border-[var(--bg-border)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'
                )}
              >
                <div
                  className={clsx(
                    'h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
                    selected === opt.value
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                  )}
                >
                  {opt.icon}
                </div>
                <div>
                  <p className={clsx(
                    'font-medium text-sm',
                    selected === opt.value ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
                  )}>
                    {opt.label}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)] mt-0.5">{opt.description}</p>
                </div>
              </button>
            ))}
          </div>

          <Button
            onClick={handleContinue}
            loading={loading}
            disabled={!selected}
            className="w-full"
          >
            {t('onboarding_continue')}
          </Button>
        </Card>
      </div>
    </div>
  )
}
