import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Layout } from '../components/Layout'

// ── Guards ───────────────────────────────────────────────────

const Loader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
    <div className="h-6 w-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
  </div>
)

function RequireAuth() {
  const { user, loading, needsOnboarding } = useAuth()
  if (loading) return <Loader />
  if (!user) return <Navigate to="/login" replace />
  // Novo usuário Google ainda sem perfil → onboarding
  if (needsOnboarding) return <Navigate to="/onboarding" replace />
  return <Layout><Outlet /></Layout>
}

function RequireOnboarding() {
  const { user, loading, needsOnboarding } = useAuth()
  if (loading) return <Loader />
  if (!user) return <Navigate to="/login" replace />
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
  // Públicas
  { path: '/login',          lazy: () => import('../pages/Login') },
  { path: '/cadastro',       lazy: () => import('../pages/Register') },
  { path: '/convite/:token', lazy: () => import('../pages/AcceptInvite') },

  // Onboarding — usuário Google autenticado sem perfil
  {
    element: <RequireOnboarding />,
    children: [
      { path: '/onboarding', lazy: () => import('../pages/Onboarding') },
    ],
  },

  // Área autenticada (com Layout)
  {
    element: <RequireAuth />,
    children: [
      { path: '/',              element: <Navigate to="/dashboard" replace /> },
      { path: '/dashboard',     lazy: () => import('../pages/Dashboard') },
      { path: '/lancamentos',   lazy: () => import('../pages/Lancamentos') },
      { path: '/fluxo-caixa',   lazy: () => import('../pages/FluxoCaixa') },
      { path: '/contas',        lazy: () => import('../pages/Contas') },
      { path: '/dre',           lazy: () => import('../pages/DRE') },
      { path: '/configuracoes', lazy: () => import('../pages/Settings') },

      {
        element: <RequireAccountant />,
        children: [
          { path: '/contador',                             lazy: () => import('../pages/contador/Dashboard') },
          { path: '/contador/empresa/:companyId',          lazy: () => import('../pages/contador/EmpresaFiscal') },
          { path: '/contador/empresa/:companyId/nfe',      lazy: () => import('../pages/contador/NFe') },
          { path: '/contador/empresa/:companyId/sped',     lazy: () => import('../pages/contador/SPED') },
          { path: '/contador/empresa/:companyId/impostos', lazy: () => import('../pages/contador/Impostos') },
        ],
      },
    ],
  },

  // Fallback
  { path: '*', element: <Navigate to="/" replace /> },
])
