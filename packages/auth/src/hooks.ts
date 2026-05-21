import { useEffect, useRef, useState } from 'react'
import { supabase, apiFetch, LANDING_URL } from './utils'
import { useAuthStore } from './store'

export function useAuth() {
  const { user, profile, activeCompany, setUser, setProfile, setActiveCompany, clear } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const lastFetchedUserId = useRef<string | null>(null)
  const lastFetchRequestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // INITIAL_SESSION cobre o hash implícito (redirect do Landing) e sessões
    // persistidas. SIGNED_IN cobre logins manuais (email/senha, OAuth popup).
    // Ambos disparam fetchProfile para evitar que o hash processado
    // assincronamente passe despercebido se getSession() retornar null.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id)
        } else {
          setLoading(false)
        }
        return
      }
      if (event === 'SIGNED_OUT') {
        lastFetchedUserId.current = null
        clear()
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
      lastFetchedUserId.current = null
    }
  }, [])

  const fetchProfile = async (_userId: string) => {
    if (lastFetchRequestRef.current) {
      lastFetchRequestRef.current.abort()
    }

    const controller = new AbortController()
    lastFetchRequestRef.current = controller

    try {
      const data = await apiFetch<{
        profile: { id: string; full_name: string; email: string; user_type: 'company_user' | 'accountant'; avatar_url: string | null } | null
        activeCompany: { id: string; name: string; role: string } | null
      }>('/api/me', {}, controller.signal)
      setProfile(data.profile)
      if (data.profile?.user_type === 'company_user' && !useAuthStore.getState().activeCompany && data.activeCompany) {
        setActiveCompany(data.activeCompany)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      // Garante que profile nunca fique undefined após erro — sem isso o
      // RequireAuth fica em loop eterno no <Loader /> (profile===undefined).
      console.error('Profile fetch failed:', err)
      setProfile(null)
      lastFetchedUserId.current = null
    } finally {
      setLoading(false)
    }
  }

  const signInWithGoogle = (redirectTo?: string) =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo ?? window.location.origin },
    })

  const signInWithEmail = (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password })

  const signUpWithEmail = (email: string, password: string) =>
    supabase.auth.signUp({ email, password })

  const resetPassword = (email: string) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

  const createProfile = async (userType: 'company_user' | 'accountant') => {
    if (!user) return { error: new Error('Usuário não autenticado') }
    try {
      await apiFetch('/api/me', { method: 'POST', body: JSON.stringify({ user_type: userType }) })
      lastFetchedUserId.current = null
      await fetchProfile(user.id)
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    clear()
    window.location.replace(LANDING_URL)
  }

  return {
    user,
    profile,
    activeCompany,
    setActiveCompany,
    loading,
    isAccountant: profile?.user_type === 'accountant',
    needsOnboarding: !!user && !loading && profile === null,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    createProfile,
    signOut,
  }
}

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