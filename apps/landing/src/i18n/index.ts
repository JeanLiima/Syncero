import { useState, useEffect } from 'react'
import { pt, type TranslationKey } from './pt'
import { en } from './en'

export type { TranslationKey }
export type Lang = 'pt' | 'en'

const STORAGE_KEY  = 'syncero-lang'
const CHANGE_EVENT = 'syncero-lang-change'

export function getLang(): Lang {
  return (localStorage.getItem(STORAGE_KEY) as Lang) || 'pt'
}

export function changeLang(lang: Lang): void {
  localStorage.setItem(STORAGE_KEY, lang)
  window.dispatchEvent(new CustomEvent<Lang>(CHANGE_EVENT, { detail: lang }))
}

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setL] = useState<Lang>(getLang)
  useEffect(() => {
    const handler = (e: Event) => setL((e as CustomEvent<Lang>).detail)
    window.addEventListener(CHANGE_EVENT, handler)
    return () => window.removeEventListener(CHANGE_EVENT, handler)
  }, [])
  return [lang, changeLang]
}

export function useT() {
  const [lang] = useLang()
  const dict = lang === 'en' ? en : pt
  return (key: TranslationKey): string => dict[key]
}
