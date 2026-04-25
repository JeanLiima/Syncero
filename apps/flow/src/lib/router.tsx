import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom'
import { LogOut, TrendingUp } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Layout } from '../components/Layout'
import { NoCompanyShell } from '../components/NoCompanyShell'
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
      <div className="h-10 w-10 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow-lg">
        <TrendingUp className="h-5 w-5 text-white" />
      </div>
      <div className="h-5 w-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
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
            <TrendingUp className="h-8 w-8 text-[var(--text-muted)]" />
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
            href={BOOKS_URL}
            className="inline-flex items-center justify-center h-10 px-4 rounded-[var(--radius-md)] bg-[var(--books)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {t("router_books")}
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

const BOOKS_URL = import.meta.env.VITE_BOOKS_URL;

function RequireAuth() {
  const { user, loading, needsOnboarding, isAccountant, activeCompany, profile } = useAuth()
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

  // profile === undefined means GET /api/me failed — show loader so the user can refresh
  if (profile === undefined) return <Loader />
  if (needsOnboarding) return <Navigate to="/onboarding" replace />
  if (isAccountant) return <WrongApp />
  if (!activeCompany) return <NoCompanyShell />
  return <Layout><Outlet /></Layout>
}

function RequireOnboarding() {
  const { user, loading, needsOnboarding } = useAuth()
  if (loading) return <Loader />
  if (!user) return <Navigate to="/login" replace />
  if (!needsOnboarding) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

// ── Router ────────────────────────────────────────────────

export const router = createBrowserRouter([
  // Public
  { path: '/login',         lazy: lazyLoad(() => import('../pages/Login')) },
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
      { path: '/transactions',  lazy: lazyLoad(() => import('../pages/Transactions')) },
      { path: '/cash-flow',     lazy: lazyLoad(() => import('../pages/CashFlow')) },
      { path: '/accounts',      lazy: lazyLoad(() => import('../pages/Accounts')) },
      { path: '/income-statement', lazy: lazyLoad(() => import('../pages/IncomeStatement')) },
      { path: '/settings',      lazy: lazyLoad(() => import('../pages/Settings')) },
      { path: '/preferences',   lazy: lazyLoad(() => import('../pages/Preferences')) },
    ],
  },

  // Fallback
  { path: '*', element: <Navigate to="/" replace /> },
])
