import { type ReactNode } from 'react'
import { NavLink, useMatch } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Building2, ArrowLeft, LayoutDashboard,
  FileText, BookOpen, Calculator, LayoutList, BookMarked, Key,
} from 'lucide-react'
import { AppLayout, type NavItem } from '@syncero/ui'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/i18n'
import { usePreferencesStore } from '@/store/preferences'
import { PWABanner } from '@/components/PWABanner'
import { apiFetch } from '@/lib/api'

export function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const t = useT()
  const { sidebarCollapsed, setSidebarCollapsed } = usePreferencesStore()

  // Detect company context — end:false matches the base path and any sub-path
  const matchCompany  = useMatch({ path: '/accountant/company/:companyId',    end: false })
  const matchExternal = useMatch({ path: '/accountant/external/:extCompanyId', end: false })

  const companyId    = matchCompany?.params.companyId
  const extCompanyId = matchExternal?.params.extCompanyId
  const isExternal   = !!extCompanyId
  const isInCompany  = !!(companyId || extCompanyId)
  const entityId     = companyId ?? extCompanyId
  const basePath     = companyId
    ? `/accountant/company/${companyId}`
    : `/accountant/external/${extCompanyId}`

  // Fetch company name — reuses the same query key as company pages (cache hit)
  const { data: companyName } = useQuery({
    queryKey: isExternal
      ? ['external-company', entityId]
      : ['company-readonly', entityId],
    queryFn: () => isExternal
      ? apiFetch<{ id: string; name: string }>(`/api/external-companies/${entityId}`)
      : apiFetch<{ id: string; name: string; cnpj: string | null; tax_regime: string | null }>(`/api/companies/${entityId}`),
    enabled: isInCompany && !!entityId,
    select: (data) => data.name,
    staleTime: 5 * 60 * 1000,
  })

  // ── Nav items ──────────────────────────────────────────────────────────────

  const icon = (Icon: React.ElementType) => <Icon className="h-4 w-4 shrink-0" />

  const companyNavItems: NavItem[] = [
    { to: basePath, label: t('nav_overview'),    icon: icon(LayoutDashboard), end: true },
    ...(companyId ? [
      { to: `${basePath}/nfe`,   label: t('nav_fiscalDocs'), icon: icon(FileText)   },
      { to: `${basePath}/sped`,  label: t('nav_sped'),       icon: icon(BookOpen)   },
      { to: `${basePath}/taxes`, label: t('nav_taxes'),      icon: icon(Calculator) },
    ] : []),
    { to: `${basePath}/plano`,       label: t('nav_accountPlan'), icon: icon(LayoutList) },
    { to: `${basePath}/lancamentos`, label: t('nav_journal'),     icon: icon(BookMarked) },
    { to: `${basePath}/api-keys`,    label: t('nav_apiKeys'),     icon: icon(Key)        },
  ]

  const defaultNavItems: NavItem[] = [
    { to: '/accountant', label: t('nav_companies'), icon: icon(Building2), end: true },
  ]

  const navItems = isInCompany ? companyNavItems : defaultNavItems

  // ── Sidebar header (company context) ──────────────────────────────────────

  const sidebarHeader = isInCompany ? (
    <div className="border-b border-[var(--bg-border)]">
      <div className="px-3 pt-2.5">
        <NavLink
          to="/accountant"
          className="flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-elevated)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors group"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0 group-hover:-translate-x-0.5 transition-transform" />
          {t('nav_companies')}
        </NavLink>
      </div>

      <div className="px-3 pt-2.5 pb-3">
        <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate leading-snug">
          {companyName ?? '…'}
        </p>
        {isExternal && (
          <span className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--success-subtle)] text-[var(--success)]">
            {t('nav_externalBadge')}
          </span>
        )}
      </div>
    </div>
  ) : undefined

  return (
    <AppLayout
      brand={{ initials: 'SB', name: 'Syncero Books' }}
      accentColor="accent"
      navItems={navItems}
      sidebarCollapsed={sidebarCollapsed}
      setSidebarCollapsed={setSidebarCollapsed}
      profile={profile ?? null}
      onSignOut={signOut}
      sidebarHeader={sidebarHeader}
      banner={<PWABanner />}
      preferencesLabel={t('nav_preferences')}
      signOutLabel={t('nav_signOut')}
    >
      {children}
    </AppLayout>
  )
}
