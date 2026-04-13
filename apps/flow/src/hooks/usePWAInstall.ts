import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Detecta se já está instalado como PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true

    if (isStandalone) {
      setIsInstalled(true)
      return
    }

    // Captura o evento nativo de instalação (Chrome/Edge/Android)
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Detecta redimensionamento: se a janela ficar pequena (< 768px de largura
    // ou numa proporção de tela móvel), exibe o banner sugerindo instalar
    const checkShouldSuggest = () => {
      const isMobileViewport = window.innerWidth < 768
      const isLandscapePhone =
        window.innerWidth < 900 && window.innerHeight < 500
      setShowBanner(isMobileViewport || isLandscapePhone)
    }

    checkShouldSuggest()
    window.addEventListener('resize', checkShouldSuggest)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('resize', checkShouldSuggest)
    }
  }, [])

  const install = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstalled(true)
      setShowBanner(false)
      setInstallPrompt(null)
    }
  }

  const dismiss = () => setShowBanner(false)

  return { canInstall: !!installPrompt, isInstalled, showBanner, install, dismiss }
}
