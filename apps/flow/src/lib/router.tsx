import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Layout } from '../components/Layout'
import { NoCompanyShell } from '../components/NoCompanyShell'

// ── Guards ───────────────────────────────────────────────────

const Loader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
    <div className="h-6 w-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
  </div>
)

const LANDING_URL = import.meta.env.VITE_LANDING_URL ?? 'https://syncero.vercel.app'

function RequireAuth() {
  const { user, loading, needsOnboarding, isAccountant, activeCompany } = useAuth()
  if (loading) return <Loader />
  if (!user) { window.location.replace(LANDING_URL); return null }
  if (needsOnboarding) return <Navigate to="/onboarding" replace />
  // company_user without a company → show focused create-company screen
  if (!isAccountant && !activeCompany) return <NoCompanyShell />
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

// ── Roteador ────────────────────────────────────────────────

export const router = createBrowserRouter([
  // Public
  { path: '/invite/:token', lazy: () => import('../pages/AcceptInvite') },

  // Onboarding — Google user without profile
  {
    element: <RequireOnboarding />,
    children: [
      { path: '/onboarding', lazy: () => import('../pages/Onboarding') },
    ],
  },

  // Authenticated (with Layout or NoCompanyShell)
  {
    element: <RequireAuth />,
    children: [
      { path: '/',              element: <Navigate to="/dashboard" replace /> },
      { path: '/dashboard',     lazy: () => import('../pages/Dashboard') },
      { path: '/transactions',  lazy: () => import('../pages/Lancamentos') },
      { path: '/cash-flow',     lazy: () => import('../pages/FluxoCaixa') },
      { path: '/accounts',      lazy: () => import('../pages/Contas') },
      { path: '/dre',           lazy: () => import('../pages/DRE') },
      { path: '/settings',      lazy: () => import('../pages/Settings') },
      { path: '/preferences',   lazy: () => import('../pages/Preferences') },

      {
        element: <RequireAccountant />,
        children: [
          { path: '/accountant',                                    lazy: () => import('../pages/contador/Dashboard') },
          { path: '/accountant/company/:companyId',                 lazy: () => import('../pages/contador/EmpresaFiscal') },
          { path: '/accountant/company/:companyId/nfe',             lazy: () => import('../pages/contador/NFe') },
          { path: '/accountant/company/:companyId/sped',            lazy: () => import('../pages/contador/SPED') },
          { path: '/accountant/company/:companyId/taxes',           lazy: () => import('../pages/contador/Impostos') },
        ],
      },
    ],
  },

  // Fallback
  { path: '*', element: <Navigate to="/" replace /> },
])
