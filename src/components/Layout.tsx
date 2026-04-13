import { type ReactNode, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ArrowUpDown,
  TrendingUp,
  CreditCard,
  BarChart2,
  Settings,
  Building2,
  LogOut,
  Menu,
  ChevronDown,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '@/hooks/useAuth'
import { Avatar } from '@/components/ui'
import { PWABanner } from '@/components/PWABanner'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
}

const companyNav: NavItem[] = [
  { to: '/dashboard',    label: 'Dashboard',       icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: '/lancamentos',  label: 'Lançamentos',      icon: <ArrowUpDown className="h-4 w-4" /> },
  { to: '/fluxo-caixa',  label: 'Fluxo de Caixa',  icon: <TrendingUp className="h-4 w-4" /> },
  { to: '/contas',       label: 'Contas',           icon: <CreditCard className="h-4 w-4" /> },
  { to: '/dre',          label: 'DRE',              icon: <BarChart2 className="h-4 w-4" /> },
  { to: '/configuracoes',label: 'Configurações',    icon: <Settings className="h-4 w-4" /> },
]

const accountantNav: NavItem[] = [
  { to: '/contador', label: 'Minhas Empresas', icon: <Building2 className="h-4 w-4" /> },
]

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/dashboard' || item.to === '/contador'}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-sm transition-colors',
          isActive
            ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-medium'
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
        )
      }
    >
      {item.icon}
      {item.label}
    </NavLink>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const { profile, activeCompany, signOut, isAccountant } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const navItems = isAccountant ? accountantNav : companyNav

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside
      className={clsx(
        'flex flex-col bg-[var(--bg-surface)] border-r border-[var(--bg-border)]',
        mobile ? 'w-full h-full' : 'w-56 min-h-screen hidden md:flex'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-[var(--bg-border)]">
        <div className="h-8 w-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
          <span className="text-white font-bold text-sm">FF</span>
        </div>
        <span className="font-semibold text-[var(--text-primary)]">Finflow</span>
      </div>

      {/* Empresa ativa */}
      {!isAccountant && activeCompany && (
        <div className="px-4 py-3 border-b border-[var(--bg-border)]">
          <p className="text-xs text-[var(--text-muted)] mb-0.5">Empresa ativa</p>
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{activeCompany.name}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {navItems.map((item) => (
          <SidebarLink key={item.to} item={item} />
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-[var(--bg-border)]">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-[var(--radius-md)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--danger)] transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)]">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 w-64 h-full">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 border-b border-[var(--bg-border)] bg-[var(--bg-surface)] flex items-center px-4 gap-3 flex-shrink-0">
          {/* Mobile menu button */}
          <button
            className="md:hidden p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Company name (mobile) */}
          {!isAccountant && activeCompany && (
            <span className="md:hidden text-sm font-medium text-[var(--text-primary)] truncate flex-1">
              {activeCompany.name}
            </span>
          )}

          <div className="flex-1 hidden md:block" />

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-md)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <Avatar name={profile?.full_name} src={profile?.avatar_url} size="sm" />
              <span className="hidden sm:block text-sm text-[var(--text-secondary)]">
                {profile?.full_name?.split(' ')[0]}
              </span>
              <ChevronDown className="h-3 w-3 text-[var(--text-muted)]" />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded-[var(--radius-md)] shadow-lg py-1">
                  <div className="px-3 py-2 border-b border-[var(--bg-border)]">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">{profile?.full_name}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{profile?.email}</p>
                    <span className="mt-1.5 inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent)]">
                      {isAccountant ? 'Contador' : 'Empresa'}
                    </span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--danger)] transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* PWA Banner */}
        <div className="px-4 pt-3">
          <PWABanner />
        </div>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden flex border-t border-[var(--bg-border)] bg-[var(--bg-surface)] safe-area-bottom">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard' || item.to === '/contador'}
              className={({ isActive }) =>
                clsx(
                  'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors',
                  isActive
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                )
              }
            >
              {item.icon}
              <span className="leading-none">{item.label.split(' ')[0]}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
