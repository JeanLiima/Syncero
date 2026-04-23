import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

const LANDING_URL = import.meta.env.VITE_LANDING_URL;

export function useAuth() {
  const { user, profile, activeCompany, setUser, setProfile, setActiveCompany, clear } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const lastFetchedUserId = useRef<string | null>(null)

  useEffect(() => {
    const bootstrapAuth = async () => {
      // detectSessionInUrl: true + flowType: 'implicit' processam o hash
      // automaticamente ao inicializar o client — leitura manual criava race
      // condition com duplo SIGNED_IN e fetchProfile preso no dedup.
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    }

    bootstrapAuth()

    // INITIAL_SESSION é descartado — bootstrapAuth + getSession() já cobrem.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
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
    if (lastFetchedUserId.current === _userId) {
      setLoading(false)
      return
    }
    lastFetchedUserId.current = _userId

    try {
      const data = await apiFetch<{
        profile: { id: string; full_name: string; email: string; user_type: 'company_user' | 'accountant'; avatar_url: string | null } | null
      }>('/api/me')
      setProfile(data.profile)
    } catch {
      setProfile(null)
    }
    setLoading(false)
  }

  const signInWithGoogle = (redirectTo?: string) =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo ?? window.location.origin },
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
    isAccountant:    profile?.user_type === 'accountant',
    needsOnboarding: !!user && !loading && profile === null,
    signInWithGoogle,
    createProfile,
    signOut,
  }
}
