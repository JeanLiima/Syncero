import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Layout } from '../components/Layout'
import { LogOut, BookOpen } from 'lucide-react'
import { useT } from '@/i18n'

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

const Loader = () => {
  const t = useT();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[var(--bg-base)]">
      <div className="h-10 w-10 rounded-xl bg-[var(--success)] flex items-center justify-center shadow-l">
        <BookOpen className="h-5 w-5 text-white" />
      </div>
      <div className="h-5 w-5 border-2 border-[var(--success)] border-t-transparent rounded-full animate-spin" />
      <p className="text-xs text-[var(--text-muted)] tracking-wide">{t('router_accessing')}</p>
    </div>
  )
}

function WrongApp() {
  const { signOut } = useAuth();
  const t = useT();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--bg-border)] flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-[var(--text-muted)]" />
          </div>
        </div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          {t('router_title')}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mb-8">
          {t('router_wrongApp')}
        </p>
        <div className="flex flex-col gap-3">
          <a
            href={FLOW_URL}
            className="inline-flex items-center justify-center h-10 px-4 rounded-[var(--radius-md)] bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {t("router_flow")}
          </a>
          <button
            onClick={signOut}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-sm hover:bg-[var(--bg-border)] transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            {t('router_signOut')}
          </button>
        </div>
      </div>
    </div>
  )
}

const FLOW_URL = import.meta.env.VITE_FLOW_URL;

function RequireAuth() {
  const { user, loading, isAccountant, needsOnboarding, profile } = useAuth()
  const location = useLocation()

  if (loading) return <Loader />

  if (!user) {
    localStorage.setItem('auth_return_to', location.pathname + location.search)
    return <Navigate to="/login" replace />
  }

  const returnTo = localStorage.getItem('auth_return_to')
  if (returnTo) {
    localStorage.removeItem('auth_return_to')
    return <Navigate to={returnTo} replace />
  }

  if (profile === undefined) return <Loader />
  if (needsOnboarding) return <Navigate to="/onboarding" replace />
  if (!isAccountant) return <WrongApp />
  return <Layout><Outlet /></Layout>
}

function RequireOnboarding() {
  const { user, loading, needsOnboarding } = useAuth()
  if (loading) return <Loader />
  if (!user) return <Navigate to="/login" replace />
  if (!needsOnboarding) return <Navigate to="/" replace />
  return <Outlet />
}

// ── Router ────────────────────────────────────────────────────

export const router = createBrowserRouter([
  // Public
  { path: '/login', lazy: lazyLoad(() => import('../pages/Login')) },

  // Onboarding
  {
    element: <RequireOnboarding />,
    children: [
      { path: '/onboarding', lazy: lazyLoad(() => import('../pages/Onboarding')) },
    ],
  },

  // Accountant authenticated routes
  {
    element: <RequireAuth />,
    children: [
      { path: '/',                                              element: <Navigate to="/accountant" replace /> },
      { path: '/preferences',                                   lazy: lazyLoad(() => import('../pages/Preferences')) },
      { path: '/accountant',                                    lazy: lazyLoad(() => import('../pages/accountant/Dashboard')) },
      { path: '/accountant/company/:companyId',                 lazy: lazyLoad(() => import('../pages/accountant/EmpresaFiscal')) },
      { path: '/accountant/company/:companyId/nfe',             lazy: lazyLoad(() => import('../pages/accountant/NFe')) },
      { path: '/accountant/company/:companyId/sped',            lazy: lazyLoad(() => import('../pages/accountant/SPED')) },
      { path: '/accountant/company/:companyId/taxes',           lazy: lazyLoad(() => import('../pages/accountant/Impostos')) },
      { path: '/accountant/company/:companyId/plano',           lazy: lazyLoad(() => import('../pages/accountant/PlanoDeContas')) },
      { path: '/accountant/company/:companyId/lancamentos',     lazy: lazyLoad(() => import('../pages/accountant/Lancamentos')) },
      { path: '/accountant/external/new',                       lazy: lazyLoad(() => import('../pages/accountant/ExternalCompanyNew')) },
      { path: '/accountant/external/:extCompanyId',             lazy: lazyLoad(() => import('../pages/accountant/EmpresaExterna')) },
      { path: '/accountant/external/:extCompanyId/plano',       lazy: lazyLoad(() => import('../pages/accountant/PlanoDeContas')) },
      { path: '/accountant/external/:extCompanyId/lancamentos', lazy: lazyLoad(() => import('../pages/accountant/Lancamentos')) },
      { path: '/accountant/company/:companyId/api-keys',        lazy: lazyLoad(() => import('../pages/accountant/ApiKeys')) },
      { path: '/accountant/external/:extCompanyId/api-keys',    lazy: lazyLoad(() => import('../pages/accountant/ApiKeys')) },
    ],
  },

  // Fallback
  { path: '*', element: <Navigate to="/" replace /> },
])
