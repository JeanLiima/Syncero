import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export function useAuth() {
  const { user, profile, activeCompany, setUser, setProfile, setActiveCompany, clear } = useAuthStore()
  const [loading, setLoading] = useState(true)

  // ── Como funciona o auth cross-domínio neste monorepo ────────
  //
  // 1. Usuário loga na landing com Google OAuth (PKCE ou implicit).
  // 2. Landing detecta a sessão, consulta o perfil e redireciona:
  //    window.location.replace('https://flow.app/#access_token=X&refresh_token=Y&...')
  // 3. Flow carrega com o hash na URL.
  //
  // PROBLEMA: o projeto Supabase pode estar em modo PKCE. Nesse modo,
  // detectSessionInUrl procura por ?code= na query string, NÃO por
  // #access_token= no hash. O hash enviado pela landing é ignorado.
  //
  // SOLUÇÃO: ler o hash manualmente e chamar supabase.auth.setSession()
  // antes de qualquer coisa. Isso funciona independentemente do flowType
  // e da versão do @supabase/supabase-js instalada.

  const lastFetchedUserId = useRef<string | null>(null)

  useEffect(() => {
    const bootstrapAuth = async () => {
      // 1. Se há #access_token no hash, aplicar a sessão manualmente.
      //    Contorna a diferença de comportamento entre PKCE e implicit
      //    no detectSessionInUrl.
      const hash = window.location.hash
      if (hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken  = params.get('access_token')  ?? ''
        const refreshToken = params.get('refresh_token') ?? ''

        if (accessToken) {
          // setSession() valida os tokens, salva no localStorage desta
          // origem e dispara SIGNED_IN no onAuthStateChange.
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          // Limpar o hash para não expor os tokens na URL após o login.
          window.history.replaceState(null, '', window.location.pathname)
        }
      }

      // 2. Buscar a sessão atual (que pode ter sido acabou de ser setada acima,
      //    ou já existia no localStorage desta origem de um login anterior).
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    }

    bootstrapAuth()

    // onAuthStateChange cobre mudanças após a inicialização:
    // TOKEN_REFRESHED, SIGNED_OUT, e outros eventos do ciclo de vida.
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

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    // Guard: bootstrapAuth e onAuthStateChange podem disparar fetchProfile
    // para o mesmo userId em sequência. Apenas uma query por usuário.
    if (lastFetchedUserId.current === userId) return
    lastFetchedUserId.current = userId

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, user_type, avatar_url')
      .eq('id', userId)
      .single()

    // null quando o usuário entrou pela primeira vez e ainda não tem perfil
    setProfile(data)

    // Restaurar activeCompany do banco quando o localStorage do Flow está vazio
    // (primeiro acesso neste domínio/dispositivo via hash redirect da landing).
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
    // Redirect de accountant→Books fica no RequireAuth (router.tsx),
    // mantendo fetchProfile como função de leitura pura.
  }

  const signInWithGoogle = (redirectTo?: string) =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo ?? import.meta.env.VITE_APP_URL ?? window.location.origin },
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
