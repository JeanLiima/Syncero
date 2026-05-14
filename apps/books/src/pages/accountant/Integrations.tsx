import { useT } from '@/i18n'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { CertificatesTab } from './Settings'

export function Component() {
  const t = useT()
  const { companyId, extCompanyId } = useCompanyContext()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('settings_integrations')}</h1>
      <CertificatesTab companyId={companyId} extCompanyId={extCompanyId} />
    </div>
  )
}
