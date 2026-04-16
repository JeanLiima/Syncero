import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não configuradas.')
}
// Landing é o hub de autenticação do monorepo.
// persistSession: false — a sessão vive no Flow/Books, não aqui.
// detectSessionInUrl: true — lê #access_token=... do callback do OAuth.
// flowType: 'implicit' — garante que o hash é usado (não PKCE com ?code=...)
//   em qualquer versão do @supabase/supabase-js, já que o default mudou
//   de 'implicit' para 'pkce' em versões ≥ 2.49.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    detectSessionInUrl: true,
    flowType: 'implicit'
  },
})
