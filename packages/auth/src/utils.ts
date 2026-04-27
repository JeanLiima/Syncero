import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
    detectSessionInUrl: true,
    persistSession: true,
  },
})

export const LANDING_URL = import.meta.env.VITE_LANDING_URL

// Simple fetch wrapper for API calls
export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {},
  signal?: AbortSignal
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const url = `${import.meta.env.VITE_API_URL || ''}${endpoint}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    signal,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`)
  }

  return response.json()
}