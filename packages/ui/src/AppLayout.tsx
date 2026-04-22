import { type ReactNode, useState, useRef, useEffect } from 'react'
import { NavLink, Link } from 'react-router-dom'
import {
  LogOut,
  Menu,
  ChevronDown,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { clsx } from 'clsx'
import { Avatar } from './Avatar'

// ── Types ─────────────────────────────────────────────────────

export interface NavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}

export interface AppLayoutProps {
  children: ReactNode
  brand: { initials: string; name: string }
  navItems: NavItem[]
  sidebarCollapsed: boolean
  setSidebarCollapsed: (v: boolean) => void
  profile: { full_name?: string | null; email?: string | null; avatar_url?: string | null } | null
  userRoleLabel?: string
  onSignOut: () => void | Promise<void>
  sidebarHeader?: ReactNode
  topbarMobileLeft?: ReactNode
  banner?: ReactNode
  preferencesLabel: string
  signOutLabel: string
  /** 'accent' (azul, padrão) | 'success' (verde — Books) */
  accentColor?: 'accent' | 'success'
}

const colorMap = {
  accent:  { brand: 'bg-[var(--accent)]',   active: 'bg-[var(--accent-subtle)] text-[var(--accent)]',   mobileActive: 'text-[var(--accent)]'   },
  success: { brand: 'bg-[var(--success)]',  active: 'bg-[var(--success-subtle)] text-[var(--success)]', mobileActive: 'text-[var(--success)]'  },
} as const

// ── SidebarLink ───────────────────────────────────────────────

function SidebarLink({ item, collapsed, activeClass }: { item: NavItem; collapsed: boolean; activeClass: string }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        clsx(
          'flex w-full items-center gap-3 rounded-[var(--radius-md)] text-sm transition-colors',
          collapsed ? 'justify-center px-2 py-3' : 'px-3 py-3',
          isActive
            ? `${activeClass} font-medium`
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
        )
      }
    >
      {item.icon}
      {!collapsed && item.label}
    </NavLink>
  )
}

// ── AppLayout ─────────────────────────────────────────────────

export function AppLayout({
  children,
  brand,
  navItems,
  sidebarCollapsed,
  setSidebarCollapsed,
  profile,
  userRoleLabel,
  onSignOut,
  sidebarHeader,
  topbarMobileLeft,
  banner,
  preferencesLabel,
  signOutLabel,
  accentColor = 'accent',
}: AppLayoutProps) {
  const colors = colorMap[accentColor]
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [userMenuOpen])

  function Sidebar({ mobile = false }: { mobile?: boolean }) {
    const collapsed = mobile ? false : sidebarCollapsed
    return (
      <aside
        className={clsx(
          'flex flex-col bg-[var(--bg-surface)] border-r border-[var(--bg-border)] transition-all duration-200',
          mobile
            ? 'w-full h-full'
            : collapsed
              ? 'w-14 min-h-screen hidden md:flex'
              : 'w-56 min-h-screen hidden md:flex',
        )}
      >
        {/* Logo + botão de recolher */}
        <div
          className={clsx(
            'flex items-center border-b border-[var(--bg-border)]',
            collapsed
              ? 'flex-col gap-2 px-2 py-3 min-h-[3.5rem]'
              : 'h-14 px-4 gap-2',
          )}
        >
          <div className={clsx('h-8 w-8 shrink-0 rounded-lg flex items-center justify-center', colors.brand)}>
            <span className="text-white font-bold text-sm">{brand.initials}</span>
          </div>
          {!collapsed && (
            <span className="font-semibold text-[var(--text-primary)] flex-1 truncate">{brand.name}</span>
          )}
          {!mobile && (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
              className="cursor-pointer shrink-0 p-1.5 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)] transition-colors"
            >
              {sidebarCollapsed
                ? <PanelLeftOpen  className="h-4 w-4" />
                : <PanelLeftClose className="h-4 w-4" />}
            </button>
          )}
        </div>

        {!collapsed && sidebarHeader}

        <nav className={clsx('flex-1 py-4 flex flex-col gap-1', collapsed ? 'px-2' : 'px-3')}>
          {navItems.map((item) => (
            <SidebarLink key={item.to} item={item} collapsed={collapsed} activeClass={colors.active} />
          ))}
        </nav>
      </aside>
    )
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)]">
      <Sidebar />

      {/* Overlay mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 w-64 h-full">
            <Sidebar mobile />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 border-b border-[var(--bg-border)] bg-[var(--bg-surface)] flex items-center px-4 gap-3 flex-shrink-0">
          <button
            className="md:hidden p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {topbarMobileLeft}

          <div className="flex-1 hidden md:block" />

          {/* Menu do usuário */}
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="cursor-pointer flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-md)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <Avatar name={profile?.full_name} src={profile?.avatar_url} size="sm" />
              <span className="hidden sm:block text-sm text-[var(--text-secondary)]">
                {profile?.full_name?.split(' ')[0]}
              </span>
              <ChevronDown className="h-3 w-3 text-[var(--text-muted)]" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded-[var(--radius-md)] shadow-lg py-1">
                <div className="px-3 py-2 border-b border-[var(--bg-border)]">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">{profile?.full_name}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{profile?.email}</p>
                  {userRoleLabel && (
                    <span className="mt-1.5 inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent)]">
                      {userRoleLabel}
                    </span>
                  )}
                </div>
                <Link
                  to="/preferences"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  {preferencesLabel}
                </Link>
                <button
                  onClick={onSignOut}
                  className="cursor-pointer flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--danger)] transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  {signOutLabel}
                </button>
              </div>
            )}
          </div>
        </header>

        {banner && <div className="px-4 pt-3">{banner}</div>}

        <main className="flex-1 p-4 md:p-6">{children}</main>

        {/* Nav mobile bottom */}
        <nav className="md:hidden flex border-t border-[var(--bg-border)] bg-[var(--bg-surface)] safe-area-bottom">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors',
                  isActive ? colors.mobileActive : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
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
