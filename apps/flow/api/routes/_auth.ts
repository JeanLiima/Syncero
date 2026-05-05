import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

// ── GET /api/me ────────────────────────────────────────────────
router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()

  const [profileRes, memberRes] = await Promise.all([
    db.from('profiles')
      .select('id, full_name, email, user_type, avatar_url')
      .eq('id', userId)
      .single(),
    db.from('company_members')
      .select('role, companies(id, name, segment)')
      .eq('user_id', userId)
      .eq('status', 'accepted')
      .limit(1)
      .maybeSingle(),
  ])

  let activeCompany = null
  if (memberRes.data?.companies) {
    const co = memberRes.data.companies as unknown as { id: string; name: string; segment: string | null }
    activeCompany = { id: co.id, name: co.name, role: memberRes.data.role, segment: co.segment }
  }

  return c.json({ profile: profileRes.data, activeCompany })
})

// ── POST /api/me ───────────────────────────────────────────────
router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { user_type } = await c.req.json<{ user_type: string }>()

  const VALID_USER_TYPES = ['company_user', 'accountant'] as const
  if (!VALID_USER_TYPES.includes(user_type as typeof VALID_USER_TYPES[number])) {
    return c.json({ error: 'user_type must be company_user or accountant' }, 400)
  }

  const { data: { user } } = await db.auth.admin.getUserById(userId)
  const fullName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email?.split('@')[0] ?? 'Usuário'
  const avatarUrl = (user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null) as string | null

  const { error } = await db.from('profiles').upsert(
    { id: userId, full_name: fullName, email: user?.email ?? '', user_type, avatar_url: avatarUrl },
    { onConflict: 'id' }
  )
  if (error) return c.json({ error: error.message }, 400)

  const { data: profile } = await db.from('profiles')
    .select('id, full_name, email, user_type, avatar_url')
    .eq('id', userId)
    .single()

  return c.json({ profile })
})

export default router
