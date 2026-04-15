import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export function useAuth() {
  const { user, profile, activeCompany, setUser, setProfile, setActiveCompany, clear } = useAuthStore()
  const [loading, setLoading] = useState(true)

  // ── Como funciona o auth cross-domínio neste monorepo ────────
  //
  // 1. Usuário loga na landing (syncero.vercel.app) com Google OAuth.
  // 2. A landing identifica o perfil como 'accountant' e redireciona:
  //    window.location.replace('https://books.app/#access_token=X&refresh_token=Y&...')
  // 3. O Books carrega com o hash na URL. O cliente Supabase do Books lê o hash
  //    (detectSessionInUrl: true, flowType: 'implicit'), salva a sessão no
  //    localStorage DESTE domínio e dispara SIGNED_IN.
  // 4. O hook abaixo detecta a sessão, busca o perfil e exibe o dashboard.

  // Guard: getSession() e SIGNED_IN podem disparar fetchProfile para o mesmo
  // userId em sequência. O ref evita duas queries simultâneas ao banco.
  const lastFetchedUserId = useRef<string | null>(null)

  useEffect(() => {
    // getSession() captura a sessão já em memória/localStorage.
    // Quando a página carrega com #access_token=... (redirect da landing), o Supabase
    // pode ainda estar processando o hash — getSession() retorna null nesse caso.
    // O evento SIGNED_IN do onAuthStateChange virá em seguida com a sessão real.
    // Por isso, NÃO setamos loading=false quando há access_token no hash.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id)
      } else if (!window.location.hash.includes('access_token=')) {
        // Sem sessão E sem hash → não autenticado
        setLoading(false)
      }
      // Se há hash mas getSession retornou null: aguardar SIGNED_IN abaixo
    })

    // SIGNED_IN dispara depois do Supabase processar o hash da URL.
    // INITIAL_SESSION descartado — getSession() já o cobre.
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

    // null quando o usuário entrou pela primeira vez e ainda não tem perfil
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
