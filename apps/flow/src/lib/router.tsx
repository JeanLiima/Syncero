import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { LogOut, TrendingUp } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Layout } from '../components/Layout'
import { NoCompanyShell } from '../components/NoCompanyShell'

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

const Loader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[var(--bg-base)]">
    <div className="h-10 w-10 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow-lg shadow-blue-500/20">
      <TrendingUp className="h-5 w-5 text-white" />
    </div>
    <div className="h-5 w-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
    <p className="text-xs text-[var(--text-muted)] tracking-wide">Acessando...</p>
  </div>
)

function WrongApp() {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--bg-border)] flex items-center justify-center">
            <TrendingUp className="h-8 w-8 text-[var(--text-muted)]" />
          </div>
        </div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          Syncero Flow é para empresa
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mb-8">
          Sua conta não possui perfil de contador. Se você é empresário, acesse o Syncero Flow.
        </p>
        <div className="flex flex-col gap-3">
          <a
            href={BOOKS_URL}
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

const LANDING_URL = import.meta.env.VITE_LANDING_URL;
const BOOKS_URL   = import.meta.env.VITE_BOOKS_URL;

function RequireAuth() {
  const { user, loading, needsOnboarding, isAccountant, activeCompany } = useAuth()
  if (loading) return <Loader />
  if (!user) { window.location.replace(LANDING_URL); return null }
  if (needsOnboarding) return <Navigate to="/onboarding" replace />
  if (isAccountant) return <WrongApp />
  if (!activeCompany) return <NoCompanyShell />
  return <Layout><Outlet /></Layout>
}

function RequireOnboarding() {
  const { user, loading, needsOnboarding } = useAuth()
  if (loading) return <Loader />
  if (!user) { window.location.replace(LANDING_URL); return null }
  if (!needsOnboarding) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

function RequireAccountant() {
  const { isAccountant, loading } = useAuth()
  if (loading) return null
  if (!isAccountant) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

// ── Router ────────────────────────────────────────────────

export const router = createBrowserRouter([
  // Public
  { path: '/invite/:token', lazy: lazyLoad(() => import('../pages/AcceptInvite')) },

  // Onboarding — Google user without profile
  {
    element: <RequireOnboarding />,
    children: [
      { path: '/onboarding', lazy: lazyLoad(() => import('../pages/Onboarding')) },
    ],
  },

  // Authenticated (with Layout or NoCompanyShell)
  {
    element: <RequireAuth />,
    children: [
      { path: '/',              element: <Navigate to="/dashboard" replace /> },
      { path: '/dashboard',     lazy: lazyLoad(() => import('../pages/Dashboard')) },
      { path: '/transactions',  lazy: lazyLoad(() => import('../pages/Lancamentos')) },
      { path: '/cash-flow',     lazy: lazyLoad(() => import('../pages/FluxoCaixa')) },
      { path: '/accounts',      lazy: lazyLoad(() => import('../pages/Contas')) },
      { path: '/dre',           lazy: lazyLoad(() => import('../pages/DRE')) },
      { path: '/settings',      lazy: lazyLoad(() => import('../pages/Settings')) },
      { path: '/preferences',   lazy: lazyLoad(() => import('../pages/Preferences')) },

      {
        element: <RequireAccountant />,
        children: [
          { path: '/accountant',                                    lazy: lazyLoad(() => import('../pages/contador/Dashboard')) },
          { path: '/accountant/company/:companyId',                 lazy: lazyLoad(() => import('../pages/contador/EmpresaFiscal')) },
          { path: '/accountant/company/:companyId/nfe',             lazy: lazyLoad(() => import('../pages/contador/NFe')) },
          { path: '/accountant/company/:companyId/sped',            lazy: lazyLoad(() => import('../pages/contador/SPED')) },
          { path: '/accountant/company/:companyId/taxes',           lazy: lazyLoad(() => import('../pages/contador/Impostos')) },
        ],
      },
    ],
  },

  // Fallback
  { path: '*', element: <Navigate to="/" replace /> },
])
