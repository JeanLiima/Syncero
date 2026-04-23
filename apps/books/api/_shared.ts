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
