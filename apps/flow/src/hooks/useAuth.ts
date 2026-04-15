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
  //   - Using both getSession() AND onAuthStateChange causes fetchProfile to be
  //     called twice for the same user (race condition, duplicate DB queries,
  //     potential setState-after-unmount warnings).
  //   - lastFetchedUserId ref ensures that even if INITIAL_SESSION + SIGNED_IN
  //     both fire (e.g. after an OAuth hash redirect from landing), fetchProfile
  //     only runs once per distinct user.
  //
  // Cross-domain session transfer:
  //   Landing redirects here as `{flowUrl}#access_token=...&refresh_token=...`.
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

    // Accountants belong in Books — redirect with session hash (cross-domain transfer)
    if (data?.user_type === 'accountant') {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const BOOKS_URL = import.meta.env.VITE_BOOKS_URL ?? 'https://syncero-books.vercel.app'
        const hash = new URLSearchParams({
          access_token:  session.access_token,
          refresh_token: session.refresh_token ?? '',
          token_type:    'bearer',
          expires_in:    String(session.expires_in ?? 3600),
          type:          'login',
        })
        window.location.replace(`${BOOKS_URL}#${hash.toString()}`)
        setLoading(false)
        return
      }
    }

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
