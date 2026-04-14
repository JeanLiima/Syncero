import { Download, X } from 'lucide-react'
import { usePWAInstall } from '../hooks/usePWAInstall'

export function PWABanner() {
  const { showBanner, canInstall, isInstalled, install, dismiss } = usePWAInstall()

  // Não exibe se já instalado ou se o banner foi dispensado
  if (isInstalled || !showBanner) return null

  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/60">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
        <Download className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Instale o Syncero Flow
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Acesso rápido, notificações e uso offline
        </p>
      </div>

      {canInstall ? (
        // Chrome/Edge/Android — prompt nativo disponível
        <button
          onClick={install}
          className="flex-shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 active:scale-95 transition-transform"
        >
          Instalar
        </button>
      ) : (
        // iOS Safari — instrução manual
        <span className="flex-shrink-0 text-xs text-zinc-500 dark:text-zinc-400 max-w-[120px] text-right leading-tight">
          Toque em <strong>Compartilhar</strong> → <strong>Tela de Início</strong>
        </span>
      )}

      <button
        onClick={dismiss}
        aria-label="Fechar banner"
        className="flex-shrink-0 rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
