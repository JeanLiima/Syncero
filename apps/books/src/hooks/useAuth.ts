import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export function useAuth() {
  const { user, profile, activeCompany, setUser, setProfile, setActiveCompany, clear } = useAuthStore()
  const [loading, setLoading] = useState(true)

  // ── Como funciona o auth cross-domínio neste monorepo ────────
  //
  // Landing detecta o perfil do usuário após OAuth e redireciona contadores para:
  // window.location.replace('https://books.app/#access_token=X&refresh_token=Y&...')
  //
  // PROBLEMA: em modo PKCE (padrão em versões recentes do Supabase),
  // detectSessionInUrl ignora #access_token= e só processa ?code=.
  //
  // SOLUÇÃO: ler o hash manualmente e chamar supabase.auth.setSession().
  // Funciona independentemente do flowType e da versão instalada.

  const lastFetchedUserId = useRef<string | null>(null)

  useEffect(() => {
    const bootstrapAuth = async () => {
      // 1. Se há #access_token no hash, aplicar a sessão manualmente.
      const hash = window.location.hash
      if (hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken  = params.get('access_token')  ?? ''
        const refreshToken = params.get('refresh_token') ?? ''

        if (accessToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          window.history.replaceState(null, '', window.location.pathname)
        }
      }

      // 2. Buscar a sessão atual (recém-setada ou do localStorage).
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
    if (lastFetchedUserId.current === userId) return
    lastFetchedUserId.current = userId

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, user_type, avatar_url')
      .eq('id', userId)
      .single()

    setProfile(data)
    setLoading(false)
  }

  const signInWithGoogle = (redirectTo?: string) =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo ?? (import.meta.env.VITE_APP_URL ?? window.location.origin),
      },
    })

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
