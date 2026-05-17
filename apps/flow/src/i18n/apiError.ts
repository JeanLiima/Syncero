import { pt } from './pt'
import type { TranslationKey } from './pt'

/**
 * Maps a backend error code to a translated user-facing message.
 * Backend returns lowercase_underscore codes (e.g. 'accountant_already_linked').
 * If the code matches an `api_error_*` translation key, returns that translation.
 * Otherwise returns the fallback translation.
 */
export function apiError(
  err: unknown,
  t: (key: TranslationKey) => string,
  fallback: TranslationKey
): string {
  const code = err instanceof Error ? err.message : ''
  const key = `api_error_${code}` as TranslationKey
  if (key in pt) return t(key)
  return t(fallback)
}
