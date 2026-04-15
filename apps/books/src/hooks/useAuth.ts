import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export function useAuth() {
  const { user, profile, activeCompany, setUser, setProfile, setActiveCompany, clear } = useAuthStore()
  const [loading, setLoading] = useState(true)

  // ── Session initialisation ────────────────────────────────────
  // We rely solely on onAuthStateChange (no separate getSession() call).
  // Reasons:
  //   - onAuthStateChange always fires INITIAL_SESSION on mount, covering the
  //     "existing session in localStorage" case identically to getSession().
  //   - Using both causes fetchProfile to be called twice for the same user.
  //   - lastFetchedUserId ref deduplicates INITIAL_SESSION + SIGNED_IN double-fire
  //     after an OAuth hash redirect from landing.
  //
  // Cross-domain session transfer:
  //   Landing redirects here as `{booksUrl}#access_token=...&refresh_token=...`.
  //   Supabase (detectSessionInUrl: true) reads that hash, stores the tokens in
  //   THIS app's localStorage (key: sb-{projectId}-auth-token), fires SIGNED_IN,
  //   then cleans the URL. No manual localStorage manipulation needed.
  const lastFetchedUserId = useRef<string | null>(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        lastFetchedUserId.current = null
        clear()
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    // Prevent duplicate calls for the same user (INITIAL_SESSION + SIGNED_IN
    // both fire after an OAuth hash redirect — guard ensures one DB round-trip).
    if (lastFetchedUserId.current === userId) return
    lastFetchedUserId.current = userId

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, user_type, avatar_url')
      .eq('id', userId)
      .single()
    // data é null quando o usuário acabou de entrar pelo Google e ainda não tem perfil
    setProfile(data)
    setLoading(false)
  }

  // Inicia fluxo OAuth com Google — Supabase redireciona de volta para redirectTo
  const signInWithGoogle = (redirectTo?: string) =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo ?? (import.meta.env.VITE_APP_URL ?? window.location.origin),
      },
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
    if (!error) {
      // Reset the guard so the post-onboarding fetchProfile actually runs
      // (the guard already holds this userId from the initial load).
      lastFetchedUserId.current = null
      await fetchProfile(user.id)
    }
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
