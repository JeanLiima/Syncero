import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Layout } from '../components/Layout'
import { LogOut, BookOpen } from 'lucide-react'

// Recovers from stale chunk errors after Vercel redeploys
const lazyLoad = <T extends object>(fn: () => Promise<T>) => async (): Promise<T> => {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof Error && (e.message.includes('Failed to fetch') || e.message.includes('dynamically imported module'))) {
      window.location.reload()
      return {} as T
    }
    throw e
  }
}

// ── Guards ───────────────────────────────────────────────────

const Loader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
    <div className="h-6 w-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
  </div>
)

function WrongApp() {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--bg-border)] flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-[var(--text-muted)]" />
          </div>
        </div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          Syncero Books é para contadores
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mb-8">
          Sua conta não possui perfil de contador. Se você é empresário, acesse o Syncero Flow.
        </p>
        <div className="flex flex-col gap-3">
          <a
            href="https://syncero-flow.vercel.app"
            className="inline-flex items-center justify-center h-10 px-4 rounded-[var(--radius-md)] bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Acessar Syncero Flow
          </a>
          <button
            onClick={signOut}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-sm hover:bg-[var(--bg-border)] transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}

const LANDING_URL = import.meta.env.VITE_LANDING_URL ?? 'https://syncero.vercel.app'

function RequireAccountant() {
  const { user, loading, isAccountant, needsOnboarding } = useAuth()
  if (loading) return <Loader />
  if (!user) { window.location.replace(LANDING_URL); return null }
  if (needsOnboarding) return <Navigate to="/onboarding" replace />
  if (!isAccountant) return <WrongApp />
  return <Layout><Outlet /></Layout>
}

function RequireOnboarding() {
  const { user, loading, needsOnboarding } = useAuth()
  if (loading) return <Loader />
  if (!user) { window.location.replace(LANDING_URL); return null }
  if (!needsOnboarding) return <Navigate to="/" replace />
  return <Outlet />
}

// ── Router ────────────────────────────────────────────────────

export const router = createBrowserRouter([
  // No public login — auth is centralized at syncero.vercel.app

  // Onboarding
  {
    element: <RequireOnboarding />,
    children: [
      { path: '/onboarding', lazy: lazyLoad(() => import('../pages/Onboarding')) },
    ],
  },

  // Accountant authenticated routes
  {
    element: <RequireAccountant />,
    children: [
      { path: '/',                                              element: <Navigate to="/accountant" replace /> },
      { path: '/preferences',                                   lazy: lazyLoad(() => import('../pages/Preferences')) },
      { path: '/accountant',                                    lazy: lazyLoad(() => import('../pages/accountant/Dashboard')) },
      { path: '/accountant/company/:companyId',                 lazy: lazyLoad(() => import('../pages/accountant/EmpresaFiscal')) },
      { path: '/accountant/company/:companyId/nfe',             lazy: lazyLoad(() => import('../pages/accountant/NFe')) },
      { path: '/accountant/company/:companyId/sped',            lazy: lazyLoad(() => import('../pages/accountant/SPED')) },
      { path: '/accountant/company/:companyId/taxes',           lazy: lazyLoad(() => import('../pages/accountant/Impostos')) },
    ],
  },

  // Fallback
  { path: '*', element: <Navigate to="/" replace /> },
])
