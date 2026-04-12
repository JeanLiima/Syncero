import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input, Card, Select } from '@/components/ui'

const schema = z.object({
  full_name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  user_type: z.enum(['company_user', 'accountant']),
})

type FormData = z.infer<typeof schema>

export function Component() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { user_type: 'company_user' },
  })

  const onSubmit = async (data: FormData) => {
    const { error } = await signUp(data.email, data.password, data.full_name, data.user_type)
    if (error) {
      setError('root', { message: error.message ?? 'Erro ao criar conta' })
    } else {
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-[var(--accent)] flex items-center justify-center">
            <span className="text-white font-bold text-lg">FF</span>
          </div>
        </div>

        <Card>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-1">Criar conta</h1>
          <p className="text-sm text-[var(--text-muted)] mb-6">Bem-vindo ao Finflow</p>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input
              label="Nome completo"
              placeholder="João Silva"
              error={errors.full_name?.message}
              {...register('full_name')}
            />
            <Input
              label="E-mail"
              type="email"
              placeholder="seu@email.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Senha"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
            <Select
              label="Tipo de conta"
              error={errors.user_type?.message}
              options={[
                { value: 'company_user', label: 'Empresa' },
                { value: 'accountant',   label: 'Contador' },
              ]}
              {...register('user_type')}
            />

            {errors.root && (
              <p className="text-xs text-[var(--danger)] text-center">{errors.root.message}</p>
            )}

            <Button type="submit" loading={isSubmitting} className="w-full mt-2">
              Criar conta
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-[var(--text-muted)] mt-4">
          Já tem conta?{' '}
          <Link to="/login" className="text-[var(--accent)] hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
