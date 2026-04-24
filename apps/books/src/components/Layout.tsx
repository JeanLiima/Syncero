import { type ReactNode } from 'react'
import { Building2 } from 'lucide-react'
import { AppLayout, type NavItem } from '@syncero/ui'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/i18n'
import { usePreferencesStore } from '@/store/preferences'
import { PWABanner } from '@/components/PWABanner'

export function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const t = useT()
  const { sidebarCollapsed, setSidebarCollapsed } = usePreferencesStore()

  const navItems: NavItem[] = [
    { to: '/accountant', label: t('nav_companies'), icon: <Building2 className="h-4 w-4 shrink-0" />, end: true },
  ]

  return (
    <AppLayout
      brand={{ initials: 'SB', name: 'Syncero Books' }}
      accentColor="success"
      navItems={navItems}
      sidebarCollapsed={sidebarCollapsed}
      setSidebarCollapsed={setSidebarCollapsed}
      profile={profile ?? null}
      onSignOut={signOut}
      banner={<PWABanner />}
      preferencesLabel={t('nav_preferences')}
      signOutLabel={t('nav_signOut')}
    >
      {children}
    </AppLayout>
  )
}
