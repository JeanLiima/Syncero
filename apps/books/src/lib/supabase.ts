import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não configuradas.')
}

// Books persiste a sessão no localStorage desta origem.
// detectSessionInUrl: true — lê o #access_token=... enviado pela landing após OAuth.
// flowType: 'implicit' — garante compatibilidade com o hash construído pela landing
//   em qualquer versão do @supabase/supabase-js.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
})
