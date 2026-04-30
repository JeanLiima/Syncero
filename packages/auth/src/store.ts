import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@supabase/supabase-js'

export interface Profile {
  id: string
  full_name: string
  email: string
  user_type: 'company_user' | 'accountant'
  avatar_url: string | null
}

export interface ActiveCompany {
  id: string
  name: string
  role: string
  segment?: string | null
}

interface AuthState {
  user: User | null
  profile: Profile | null | undefined
  activeCompany: ActiveCompany | null
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null | undefined) => void
  setActiveCompany: (company: ActiveCompany | null) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      profile: undefined,
      activeCompany: null,
      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setActiveCompany: (activeCompany) => set({ activeCompany }),
      clear: () => set({ user: null, profile: undefined, activeCompany: null }),
    }),
    {
      name: 'syncero-auth',
      partialize: (s) => ({ activeCompany: s.activeCompany }),
    }
  )
)