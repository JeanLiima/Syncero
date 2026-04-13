import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Language = 'pt' | 'en'

interface PreferencesState {
  language: Language
  setLanguage: (lang: Language) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      language: 'pt',
      setLanguage: (language) => set({ language }),
    }),
    { name: 'finflow-prefs' }
  )
)
