import { createClient } from '@supabase/supabase-js'
import type { MiddlewareHandler } from 'hono'

export type HonoVariables = { userId: string; isApiKeyAuth?: boolean }

export function createServiceClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export const authMiddleware: MiddlewareHandler<{ Variables: HonoVariables }> = async (c, next) => {
  const auth = c.req.header('Authorization')
  const token = auth?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'unauthorized' }, 401)

  const admin = createServiceClient()
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return c.json({ error: 'unauthorized' }, 401)

  c.set('userId', user.id)
  await next()
}

// ── SHA-256 helper (Web Crypto — compatível com Edge Runtime) ──────
export async function sha256hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Middleware para rotas externas — aceita API Key ou Bearer JWT ──
export const apiKeyOrJwtMiddleware: MiddlewareHandler<{ Variables: HonoVariables }> = async (c, next) => {
  const apiKey = c.req.header('x-api-key')

  if (apiKey) {
    const db = createServiceClient()
    const hash = await sha256hex(apiKey)
    const now  = new Date().toISOString()

    const { data: key } = await db.from('api_keys')
      .select('accountant_id, is_active, expires_at')
      .eq('key_hash', hash)
      .eq('is_active', true)
      .maybeSingle()

    if (!key)                              return c.json({ error: 'Invalid API key' }, 401)
    if (key.expires_at && key.expires_at < now) return c.json({ error: 'API key expired' }, 401)

    c.set('userId', key.accountant_id)
    c.set('isApiKeyAuth', true)
    await next()
    return
  }

  // Fallback para Bearer JWT
  await authMiddleware(c, next)
}

// ── Origin Guard — restringe acesso a origens Syncero autorizadas ──
function getAllowedOrigins(requestHost?: string): string[] {
  const origins: string[] = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
  ]
  // ALLOWED_ORIGINS permite origens cruzadas explícitas (ex: Landing chamando Flow API)
  const env = process.env.ALLOWED_ORIGINS
  if (env) origins.push(...env.split(',').map(o => o.trim()))
  // Host é sempre incluído: garante que o próprio app pode chamar sua API
  // independente de ser alias (syncero-books.vercel.app) ou URL de deploy
  // (syncero-books-jeanliimas-projects.vercel.app)
  if (requestHost) origins.push(`https://${requestHost}`)
  return origins
}

export const originGuard: MiddlewareHandler<{ Variables: HonoVariables }> = async (c, next) => {
  const isProduction = process.env.VERCEL_ENV === 'production'
  const origin = c.req.header('Origin') ?? c.req.header('Referer')
  const allowed = getAllowedOrigins(c.req.header('Host') ?? '')

  if (isProduction) {
    if (!origin) return c.json({ error: 'Forbidden: origin required' }, 403)
    const originBase = (() => { try { return new URL(origin).origin } catch { return origin } })()
    if (!allowed.some(a => originBase === a || origin.startsWith(a))) {
      return c.json({ error: 'Forbidden: origin not allowed' }, 403)
    }
  } else if (origin && !allowed.some(a => origin.startsWith(a))) {
    console.warn(`[originGuard] Origin not in allowed list: ${origin}`)
  }

  await next()
}
