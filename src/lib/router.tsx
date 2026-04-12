import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Layout } from '../components/Layout'

// ── Guards ───────────────────────────────────────────────────

function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
      <div className="h-6 w-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return <Layout><Outlet /></Layout>
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
  { path: '/login',    lazy: () => import('../pages/Login') },
  { path: '/cadastro', lazy: () => import('../pages/Register') },
  { path: '/convite/:token', lazy: () => import('../pages/AcceptInvite') },

  // Área autenticada
  {
    element: <RequireAuth />,
    children: [

      // ── Usuários da empresa ──────────────────────────────
      { path: '/',          element: <Navigate to="/dashboard" replace /> },
      { path: '/dashboard', lazy: () => import('../pages/Dashboard') },
      { path: '/lancamentos', lazy: () => import('../pages/Lancamentos') },
      { path: '/fluxo-caixa', lazy: () => import('../pages/FluxoCaixa') },
      { path: '/contas',      lazy: () => import('../pages/Contas') },
      { path: '/dre',         lazy: () => import('../pages/DRE') },
      { path: '/configuracoes', lazy: () => import('../pages/Settings') },

      // ── Área do contador ─────────────────────────────────
      {
        element: <RequireAccountant />,
        children: [
          // Lista de empresas vinculadas ao contador
          { path: '/contador', lazy: () => import('../pages/contador/Dashboard') },
          // Acessa empresa específica (fiscal readonly)
          { path: '/contador/empresa/:companyId', lazy: () => import('../pages/contador/EmpresaFiscal') },
          { path: '/contador/empresa/:companyId/nfe',   lazy: () => import('../pages/contador/NFe') },
          { path: '/contador/empresa/:companyId/sped',  lazy: () => import('../pages/contador/SPED') },
          { path: '/contador/empresa/:companyId/impostos', lazy: () => import('../pages/contador/Impostos') },
        ],
      },
    ],
  },

  // Fallback
  { path: '*', element: <Navigate to="/" replace /> },
])
