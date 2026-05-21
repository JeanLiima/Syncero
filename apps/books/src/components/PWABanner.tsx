import { Download, X } from 'lucide-react'
import { usePWAInstall } from '../hooks/usePWAInstall'
import { useT } from '@/i18n'

export function PWABanner() {
  const t = useT()
  const { showBanner, canInstall, isInstalled, install, dismiss } = usePWAInstall()

  if (isInstalled || !showBanner) return null

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-4 py-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/20">
        <Download className="h-4 w-4 text-[var(--accent)]" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          {t('pwa_title')}
        </p>
        <p className="text-xs text-[var(--text-secondary)]">
          {t('pwa_subtitle')}
        </p>
      </div>

      {canInstall ? (
        <button
          onClick={install}
          className="flex-shrink-0 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 active:scale-95 transition-transform cursor-pointer"
        >
          {t('pwa_install')}
        </button>
      ) : (
        <span className="flex-shrink-0 text-xs text-[var(--text-muted)] max-w-[120px] text-right leading-tight">
          {t('pwa_ios')}
        </span>
      )}

      <button
        onClick={dismiss}
        aria-label={t('pwa_close')}
        className="flex-shrink-0 rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-border)] transition-colors cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
