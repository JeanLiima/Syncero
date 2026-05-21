import { usePreferencesStore } from '@/store/preferences'
import { pt, type TranslationKey } from './pt'
import { en } from './en'

export { type TranslationKey }
export { apiError } from './apiError'

export function useT() {
  const language = usePreferencesStore((s) => s.language)
  const dict = language === 'en' ? en : pt
  return (key: TranslationKey): string => dict[key] ?? key
}
