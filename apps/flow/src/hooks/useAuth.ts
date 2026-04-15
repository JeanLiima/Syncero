import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export function useAuth() {
  const { user, profile, activeCompany, setUser, setProfile, setActiveCompany, clear } = useAuthStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { clear(); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, user_type, avatar_url')
      .eq('id', userId)
      .single()
    // data é null quando o usuário acabou de entrar pelo Google e ainda não tem perfil
    setProfile(data)

    // Auto-restore active company when localStorage is empty (new domain/device)
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

  // Inicia fluxo OAuth com Google — Supabase redireciona de volta para redirectTo
  const signInWithGoogle = (redirectTo?: string) =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo ?? import.meta.env.VITE_APP_URL ?? window.location.origin },
    })

  // Chamado no Onboarding, após o primeiro login Google sem perfil
  const createProfile = async (userType: 'company_user' | 'accountant') => {
    if (!user) return { error: new Error('Usuário não autenticado') }
    const fullName =
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email?.split('@')[0] ??
      'Usuário'
    const avatarUrl: string | null =
      user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: fullName,
      email: user.email ?? '',
      user_type: userType,
      avatar_url: avatarUrl,
    }, { onConflict: 'id' })
    if (!error) await fetchProfile(user.id)
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    clear()
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
    createProfile,
    signOut,
  }
}
