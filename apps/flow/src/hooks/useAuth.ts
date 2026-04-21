import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
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

  const fetchProfile = async (userId: string) => {
    if (lastFetchedUserId.current === userId) {
      setLoading(false)
      return
    }
    lastFetchedUserId.current = userId

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, user_type, avatar_url')
      .eq('id', userId)
      .single()

    setProfile(data)

    // Restaura activeCompany do banco no primeiro acesso cross-domain
    // (localStorage do Flow ainda vazio após redirect da landing).
    if (data?.user_type === 'company_user' && !useAuthStore.getState().activeCompany) {
      const { data: membership } = await supabase
        .from('company_members')
        .select('role, companies(id, name)')
        .eq('user_id', userId)
        .eq('status', 'accepted')
        .limit(1)
        .single()
      if (membership?.companies) {
        const co = membership.companies as unknown as { id: string; name: string }
        setActiveCompany({ id: co.id, name: co.name, role: membership.role })
      }
    }

    setLoading(false)
  }

  const signInWithGoogle = (redirectTo?: string) =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo ?? import.meta.env.VITE_LANDING_URL ?? window.location.origin },
    })

  const createProfile = async (userType: 'company_user' | 'accountant') => {
    if (!user) return { error: new Error('Usuário não autenticado') }
    const fullName  = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Usuário'
    const avatarUrl = (user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null) as string | null

    const { error } = await supabase.from('profiles').upsert({
      id: user.id, full_name: fullName, email: user.email ?? '', user_type: userType, avatar_url: avatarUrl,
    }, { onConflict: 'id' })

    if (!error) {
      lastFetchedUserId.current = null
      await fetchProfile(user.id)
    }
    return { error }
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
