import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export function useAuth() {
  const { user, profile, activeCompany, setUser, setProfile, setActiveCompany, clear } = useAuthStore()
  const [loading, setLoading] = useState(true)

  // ── Como funciona o auth cross-domínio neste monorepo ────────
  //
  // 1. Usuário clica "Entrar com Google" na landing (syncero.vercel.app).
  // 2. Supabase redireciona para o Google e volta para a landing com:
  //    landing.app/#access_token=X&refresh_token=Y&token_type=bearer&...
  // 3. O cliente Supabase da landing lê o hash (detectSessionInUrl: true,
  //    flowType: 'implicit'), cria a sessão em memória (persistSession: false)
  //    e dispara SIGNED_IN.
  // 4. A landing consulta o perfil do usuário, determina o app destino
  //    (Flow para company_user, Books para accountant) e redireciona:
  //    window.location.replace('https://flow.app/#access_token=X&refresh_token=Y&...')
  // 5. O Flow carrega com o hash na URL. O cliente Supabase do Flow lê o hash
  //    (detectSessionInUrl: true, flowType: 'implicit'), salva a sessão no
  //    localStorage DESTE domínio (sb-{projectId}-auth-token) e dispara SIGNED_IN.
  // 6. O hook abaixo detecta a sessão, busca o perfil e exibe o dashboard.
  //
  // Não há escrita manual no localStorage — o Supabase faz isso automaticamente
  // ao processar o hash. O localStorage não é compartilhado entre origens.

  // Guard: getSession() e SIGNED_IN (onAuthStateChange) podem disparar
  // fetchProfile para o mesmo userId em sequência rápida. O ref evita
  // duas queries simultâneas ao banco para o mesmo usuário.
  const lastFetchedUserId = useRef<string | null>(null)

  useEffect(() => {
    // getSession() é o meio mais confiável de capturar a sessão inicial,
    // incluindo a sessão recém-parseada do hash pelo detectSessionInUrl.
    // Cobre o caso em que o Supabase terminou de processar o hash antes
    // de o useEffect registrar o listener do onAuthStateChange.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    // onAuthStateChange cobre mudanças subsequentes:
    // SIGNED_IN (novo login), SIGNED_OUT, TOKEN_REFRESHED.
    // INITIAL_SESSION é descartado porque o getSession() acima já o cobre,
    // evitando assim uma segunda chamada a fetchProfile para o mesmo userId.
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

    // Restaurar activeCompany do banco quando o localStorage do Flow está vazio
    // (primeiro acesso neste domínio/dispositivo via hash redirect da landing).
    // O router trata o caso de company_user sem empresa (NoCompanyShell).
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
    // Nota: se o usuário for accountant, o RequireAuth no router redireciona
    // para o Books. A lógica de redirecionamento não fica aqui para manter
    // fetchProfile como função de leitura pura.
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
      // Permite re-fetch após criação do perfil (o guard já tem este userId)
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
