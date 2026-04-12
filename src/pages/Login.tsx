import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input, Card } from '@/components/ui'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type FormData = z.infer<typeof schema>

export function Component() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    const { error } = await signIn(data.email, data.password)
    if (error) {
      setError('root', { message: 'E-mail ou senha incorretos' })
    } else {
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-[var(--accent)] flex items-center justify-center">
            <span className="text-white font-bold text-lg">FF</span>
          </div>
        </div>

        <Card>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-1">Entrar</h1>
          <p className="text-sm text-[var(--text-muted)] mb-6">Acesse sua conta Finflow</p>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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

            {errors.root && (
              <p className="text-xs text-[var(--danger)] text-center">{errors.root.message}</p>
            )}

            <Button type="submit" loading={isSubmitting} className="w-full mt-2">
              Entrar
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-[var(--text-muted)] mt-4">
          Não tem conta?{' '}
          <Link to="/cadastro" className="text-[var(--accent)] hover:underline">
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  )
}
