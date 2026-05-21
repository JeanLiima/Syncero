import { createClient } from '@supabase/supabase-js'
import type { MiddlewareHandler } from 'hono'

export type HonoVariables = { userId: string }

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

// ── Origin Guard — restringe acesso a origens Syncero autorizadas ──
// Em produção (VERCEL_ENV=production), bloqueia requisições de origens não listadas
// em ALLOWED_ORIGINS. Em desenvolvimento, apenas loga um aviso.

function getAllowedOrigins(): string[] {
  const env = process.env.ALLOWED_ORIGINS
  if (env) return env.split(',').map(o => o.trim())

  const origins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
  ]
  // VERCEL_URL é injetado automaticamente em todos os deploys (produção e preview)
  // Garante que o próprio app sempre pode chamar sua API sem precisar de ALLOWED_ORIGINS
  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) origins.push(`https://${vercelUrl}`)
  return origins
}

export const originGuard: MiddlewareHandler<{ Variables: HonoVariables }> = async (c, next) => {
  const isProduction = process.env.VERCEL_ENV === 'production'
  const origin = c.req.header('Origin') ?? c.req.header('Referer')
  const allowed = getAllowedOrigins()

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

// ── Authorization helpers ─────────────────────────────────────
type DB = ReturnType<typeof createServiceClient>

export async function ensureCompanyMember(db: DB, userId: string, companyId: string) {
  const { data } = await db.from('company_members')
    .select('id').eq('user_id', userId).eq('company_id', companyId).eq('status', 'accepted').maybeSingle()
  return data
}

export async function ensureCompanyAdmin(db: DB, userId: string, companyId: string) {
  const { data } = await db.from('company_members')
    .select('id').eq('user_id', userId).eq('company_id', companyId).eq('status', 'accepted').eq('role', 'admin').maybeSingle()
  return data
}
