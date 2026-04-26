import { type ReactNode } from 'react'
import {
  LayoutDashboard,
  ArrowUpDown,
  TrendingUp,
  CreditCard,
  BarChart2,
  Settings,
} from 'lucide-react'
import { AppLayout, type NavItem } from '@syncero/ui'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/i18n'
import { usePreferencesStore } from '@/store/preferences'
import { PWABanner } from '@/components/PWABanner'

export function Layout({ children }: { children: ReactNode }) {
  const { profile, activeCompany, signOut } = useAuth()
  const t = useT()
  const { sidebarCollapsed, setSidebarCollapsed } = usePreferencesStore()

  const navItems: NavItem[] = [
    { to: '/dashboard',    label: t('nav_dashboard'),    icon: <LayoutDashboard className="h-4 w-4 shrink-0" />, end: true },
    { to: '/transactions', label: t('nav_transactions'), icon: <ArrowUpDown     className="h-4 w-4 shrink-0" /> },
    { to: '/cash-flow',    label: t('nav_cashFlow'),     icon: <TrendingUp      className="h-4 w-4 shrink-0" /> },
    { to: '/accounts',     label: t('nav_accounts'),     icon: <CreditCard      className="h-4 w-4 shrink-0" /> },
    { to: '/income-statement', label: t('nav_incomeStatement'),       icon: <BarChart2       className="h-4 w-4 shrink-0" /> },
    {
      to: '/settings',
      label: t('nav_settings'),
      icon: <Settings className="h-4 w-4 shrink-0" />,
      children: [
        { to: '/settings/company',    label: t('settings_company') },
        { to: '/settings/members',    label: t('settings_members') },
        { to: '/settings/accountant', label: t('settings_accountant') },
        { to: '/settings/categories', label: t('settings_categories') },
        { to: '/settings/banks',      label: t('settings_banks') },
      ],
    },
  ]

  return (
    <AppLayout
      brand={{ icon: <TrendingUp className="h-4 w-4" />, name: 'Syncero Flow' }}
      navItems={navItems}
      sidebarCollapsed={sidebarCollapsed}
      setSidebarCollapsed={setSidebarCollapsed}
      profile={profile ?? null}
      onSignOut={signOut}
      sidebarHeader={
        activeCompany ? (
          <div className="px-4 py-3 border-b border-[var(--bg-border)]">
            <p className="text-xs text-[var(--text-muted)] mb-0.5">{t('layout_activeCompany')}</p>
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">{activeCompany.name}</p>
          </div>
        ) : undefined
      }
      topbarMobileLeft={
        activeCompany ? (
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
