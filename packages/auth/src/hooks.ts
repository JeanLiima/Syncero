import { useEffect, useRef, useState } from 'react'
import { supabase, LANDING_URL } from './utils'
import { useAuthStore } from './store'

export function useAuth() {
  const { user, profile, activeCompany, setUser, setProfile, setActiveCompany, clear } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const fetchGenRef = useRef(0)

  useEffect(() => {
    const bootstrapAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    }

    bootstrapAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return

      setUser(session?.user ?? null)
      if (session?.user) {
        setLoading(true)
        fetchProfile(session.user.id)
      } else {
        fetchGenRef.current++
        clear()
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
      fetchGenRef.current++
    }
  }, [])

  const fetchProfile = async (_userId: string, attempt = 0) => {
    const gen = ++fetchGenRef.current
    let willRetry = false

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, user_type, avatar_url')
        .eq('id', _userId)
        .maybeSingle()

      if (gen !== fetchGenRef.current) return
      if (error) throw error

      setProfile(profile as any)

      if (profile?.user_type === 'company_user' && !useAuthStore.getState().activeCompany) {
        const { data: member } = await supabase
          .from('company_members')
          .select('role, companies!inner(id, name)')
          .eq('user_id', _userId)
          .eq('status', 'accepted')
          .maybeSingle()

        if (gen !== fetchGenRef.current) return
        if (member?.companies) {
          const co = member.companies as unknown as { id: string; name: string }
          setActiveCompany({ id: co.id, name: co.name, role: member.role })
        }
      }
    } catch (err) {
      if (gen !== fetchGenRef.current) return
      console.error('Profile fetch failed:', err)
      if (attempt < 1) {
        willRetry = true
      }
    } finally {
      if (gen === fetchGenRef.current && !willRetry) {
        setLoading(false)
      }
    }

    if (willRetry) {
      setTimeout(() => fetchProfile(_userId, attempt + 1), 2000)
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
      const email = user.email ?? ''
      const full_name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? email
      const avatar_url = user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null

      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, user_type: userType, email, full_name, avatar_url }, { onConflict: 'id' })

      if (error) throw error
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
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true

    if (isStandalone) {
      setIsInstalled(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

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
