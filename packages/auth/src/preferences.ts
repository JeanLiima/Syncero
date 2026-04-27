import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Language = 'pt' | 'en'

interface PreferencesState {
  language: Language
  sidebarCollapsed: boolean
  setLanguage: (lang: Language) => void
  setSidebarCollapsed: (v: boolean) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      language: 'pt',
      sidebarCollapsed: false,
      setLanguage: (language) => set({ language }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    { name: 'syncero-prefs' }
  )
)