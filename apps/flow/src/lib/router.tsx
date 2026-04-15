import { useEffect } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Layout } from '../components/Layout'
import { NoCompanyShell } from '../components/NoCompanyShell'
import { supabase } from '../lib/supabase'

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
  <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[var(--bg-base)]">
    <div className="h-10 w-10 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow-lg shadow-blue-500/20">
      <TrendingUp className="h-5 w-5 text-white" />
    </div>
    <div className="h-5 w-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
  </div>
)

const LANDING_URL = import.meta.env.VITE_LANDING_URL ?? 'https://syncero.vercel.app'
const BOOKS_URL   = import.meta.env.VITE_BOOKS_URL   ?? 'https://syncero-books.vercel.app'

function RequireAuth() {
  const { user, loading, needsOnboarding, isAccountant, activeCompany } = useAuth()

  // Contador que abriu o Flow por engano → redirecionar para Books com sessão.
  // O redirect é feito em useEffect para não bloquear a renderização e para
  // garantir que a sessão já foi persistida no localStorage antes de sair.
  useEffect(() => {
    if (loading || !isAccountant) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.replace(LANDING_URL); return }
      const hash = new URLSearchParams({
        access_token:  session.access_token,
        refresh_token: session.refresh_token ?? '',
        token_type:    'bearer',
        expires_in:    String(session.expires_in ?? 3600),
        type:          'login',
      })
      window.location.replace(`${BOOKS_URL}#${hash.toString()}`)
    })
  }, [loading, isAccountant])

  if (loading) return <Loader />
  if (!user) { window.location.replace(LANDING_URL); return null }
  if (needsOnboarding) return <Navigate to="/onboarding" replace />
  if (isAccountant) return <Loader /> // redirect para Books em andamento
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

// ── Roteador ────────────────────────────────────────────────

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
