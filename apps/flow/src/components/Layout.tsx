import { type ReactNode } from 'react'
import {
  LayoutDashboard,
  ArrowUpDown,
  TrendingUp,
  CreditCard,
  BarChart2,
  Settings,
  Building2,
} from 'lucide-react'
import { AppLayout, type NavItem } from '@syncero/ui'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/i18n'
import { usePreferencesStore } from '@/store/preferences'
import { PWABanner } from '@/components/PWABanner'

export function Layout({ children }: { children: ReactNode }) {
  const { profile, activeCompany, signOut, isAccountant } = useAuth()
  const t = useT()
  const { sidebarCollapsed, setSidebarCollapsed } = usePreferencesStore()

  const companyNav: NavItem[] = [
    { to: '/dashboard',    label: t('nav_dashboard'),    icon: <LayoutDashboard className="h-4 w-4 shrink-0" />, end: true },
    { to: '/transactions', label: t('nav_transactions'), icon: <ArrowUpDown     className="h-4 w-4 shrink-0" /> },
    { to: '/cash-flow',    label: t('nav_cashFlow'),     icon: <TrendingUp      className="h-4 w-4 shrink-0" /> },
    { to: '/accounts',     label: t('nav_accounts'),     icon: <CreditCard      className="h-4 w-4 shrink-0" /> },
    { to: '/dre',          label: t('nav_dre'),          icon: <BarChart2       className="h-4 w-4 shrink-0" /> },
    { to: '/settings',     label: t('nav_settings'),     icon: <Settings        className="h-4 w-4 shrink-0" /> },
  ]

  const accountantNav: NavItem[] = [
    { to: '/accountant', label: t('nav_myCompanies'), icon: <Building2 className="h-4 w-4 shrink-0" />, end: true },
  ]

  return (
    <AppLayout
      brand={{ initials: 'SF', name: 'Syncero Flow' }}
      navItems={isAccountant ? accountantNav : companyNav}
      sidebarCollapsed={sidebarCollapsed}
      setSidebarCollapsed={setSidebarCollapsed}
      profile={profile}
      onSignOut={signOut}
      sidebarHeader={
        !isAccountant && activeCompany ? (
          <div className="px-4 py-3 border-b border-[var(--bg-border)]">
            <p className="text-xs text-[var(--text-muted)] mb-0.5">{t('layout_activeCompany')}</p>
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">{activeCompany.name}</p>
          </div>
        ) : undefined
      }
      topbarMobileLeft={
        !isAccountant && activeCompany ? (
          <span className="md:hidden text-sm font-medium text-[var(--text-primary)] truncate flex-1">
            {activeCompany.name}
          </span>
        ) : undefined
      }
      banner={<PWABanner />}
      preferencesLabel={t('nav_preferences')}
      signOutLabel={t('nav_signOut')}
    >
      {children}
    </AppLayout>
  )
}
