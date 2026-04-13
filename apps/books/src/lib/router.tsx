import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Layout } from '../components/Layout'

// ── Guards ───────────────────────────────────────────────────

const Loader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
    <div className="h-6 w-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
  </div>
)

function RequireAccountant() {
  const { user, loading, isAccountant, needsOnboarding } = useAuth()
  if (loading) return <Loader />
  if (!user) return <Navigate to="/login" replace />
  if (needsOnboarding) return <Navigate to="/onboarding" replace />
  if (!isAccountant) return <Navigate to="/login" replace />
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
  { path: '/login', lazy: () => import('../pages/Login') },

  // Onboarding
  {
    element: <RequireOnboarding />,
    children: [
      { path: '/onboarding', lazy: () => import('../pages/Onboarding') },
    ],
  },

  // Accountant authenticated routes
  {
    element: <RequireAccountant />,
    children: [
      { path: '/',                                              element: <Navigate to="/accountant" replace /> },
      { path: '/preferences',                                   lazy: () => import('../pages/Preferences') },
      { path: '/accountant',                                    lazy: () => import('../pages/accountant/Dashboard') },
      { path: '/accountant/company/:companyId',                 lazy: () => import('../pages/accountant/EmpresaFiscal') },
      { path: '/accountant/company/:companyId/nfe',             lazy: () => import('../pages/accountant/NFe') },
      { path: '/accountant/company/:companyId/sped',            lazy: () => import('../pages/accountant/SPED') },
      { path: '/accountant/company/:companyId/taxes',           lazy: () => import('../pages/accountant/Impostos') },
    ],
  },

  // Fallback
  { path: '*', element: <Navigate to="/" replace /> },
])
