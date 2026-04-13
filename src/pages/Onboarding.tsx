import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Calculator } from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '@/hooks/useAuth'
import { Button, Card } from '@/components/ui'
import { Avatar } from '@/components/ui'

type UserType = 'company_user' | 'accountant'

interface TypeOption {
  value: UserType
  label: string
  description: string
  icon: React.ReactNode
}

const options: TypeOption[] = [
  {
    value: 'company_user',
    label: 'Empresa',
    description: 'Gerencio as finanças de uma ou mais empresas',
    icon: <Building2 className="h-7 w-7" />,
  },
  {
    value: 'accountant',
    label: 'Contador',
    description: 'Acesso fiscal e contábil das empresas dos meus clientes',
    icon: <Calculator className="h-7 w-7" />,
  },
]

export function Component() {
  const { user, createProfile } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<UserType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const name =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split('@')[0] ??
    'Usuário'

  const avatarUrl: string | null =
    user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null

  const handleContinue = async () => {
    if (!selected) return
    setLoading(true)
    setError('')
    const { error: err } = await createProfile(selected)
    if (err) {
      setError('Erro ao criar perfil. Tente novamente.')
      setLoading(false)
    } else {
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-[var(--accent)] flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl">FF</span>
          </div>
        </div>

        <Card>
          {/* User greeting */}
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-[var(--bg-border)]">
            <Avatar name={name} src={avatarUrl} size="md" />
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Olá, {name.split(' ')[0]}!</p>
              <p className="text-xs text-[var(--text-muted)]">
                Bem-vindo ao Finflow. Como você vai usar?
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
                  'flex items-center gap-4 p-4 rounded-[var(--radius-md)] border text-left transition-all',
                  selected === opt.value
                    ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                    : 'border-[var(--bg-border)] hover:border-[var(--text-muted)]'
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
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{opt.description}</p>
                </div>
              </button>
            ))}
          </div>

          {error && (
            <p className="text-xs text-[var(--danger)] text-center mb-4">{error}</p>
          )}

          <Button
            onClick={handleContinue}
            loading={loading}
            disabled={!selected}
            className="w-full"
          >
            Continuar
          </Button>
        </Card>
      </div>
    </div>
  )
}
