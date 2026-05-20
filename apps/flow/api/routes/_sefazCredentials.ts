import { Hono } from 'hono'
import { createServiceClient, ensureCompanyAdmin, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

async function deriveKey(secret: string): Promise<CryptoKey> {
  const ab = new ArrayBuffer(secret.length)
  const view = new Uint8Array(ab)
  const encoded = new TextEncoder().encode(secret)
  for (let i = 0; i < encoded.length; i++) view[i] = encoded[i]!
  const raw = await crypto.subtle.digest('SHA-256', ab)
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function encrypt(key: CryptoKey, data: Uint8Array): Promise<{ enc: string; iv: string }> {
  const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, ab)
  return {
    enc: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  }
}

// GET /api/sefaz-credentials?company_id=...
router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const companyId = c.req.query('company_id')
  if (!companyId) return c.json({ error: 'company_id_required' }, 400)

  const admin = await ensureCompanyAdmin(db, userId, companyId)
  if (!admin) return c.json({ error: 'forbidden' }, 403)

  const { data } = await db.from('company_sefaz_credentials')
    .select('id, environment, uf_code, is_active, last_nsu, last_sync_at, last_error, created_at, updated_at')
    .eq('company_id', companyId)
    .maybeSingle()

  return c.json(data ?? null)
})

// POST /api/sefaz-credentials — upload do certificado .pfx
router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()

  const encKey = process.env.SEFAZ_CERT_KEY
  if (!encKey) return c.json({ error: 'internal_error' }, 500)

  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    return c.json({ error: 'invalid_content_type' }, 400)
  }

  const companyId   = form.get('company_id')  as string | null
  const password    = form.get('password')    as string | null
  const environment = (form.get('environment') as string | null) ?? 'production'
  const ufCode      = form.get('uf_code')     as string | null
  const certFile    = form.get('cert')        as File | null

  if (!companyId)  return c.json({ error: 'company_id_required' }, 400)
  if (!password)   return c.json({ error: 'validation_error' }, 400)
  if (!ufCode)     return c.json({ error: 'validation_error' }, 400)
  if (!certFile)   return c.json({ error: 'validation_error' }, 400)
  if (!['production', 'homologation'].includes(environment)) {
    return c.json({ error: 'validation_error' }, 400)
  }

  const admin = await ensureCompanyAdmin(db, userId, companyId)
  if (!admin) return c.json({ error: 'forbidden' }, 403)

  const pfxBytes = new Uint8Array(await certFile.arrayBuffer())
  const key = await deriveKey(encKey)

  const { enc: certEnc, iv: certIv } = await encrypt(key, pfxBytes)
  const { enc: passEnc, iv: passIv } = await encrypt(key, new TextEncoder().encode(password))

  const payload = {
    company_id:        companyId,
    cert_pfx_enc:      certEnc,
    cert_pfx_iv:       certIv,
    cert_password_enc: passEnc,
    cert_password_iv:  passIv,
    environment,
    uf_code:           ufCode,
    last_nsu:          '000000000000000',
    last_error:        null,
    last_sync_at:      null,
  }

  const { data, error } = await db.from('company_sefaz_credentials')
    .upsert(payload, { onConflict: 'company_id' })
    .select('id, environment, uf_code, is_active, last_nsu, last_sync_at, last_error, created_at, updated_at')
    .single()

  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json(data, 201)
})

// DELETE /api/sefaz-credentials?company_id=...
router.delete('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const companyId = c.req.query('company_id')
  if (!companyId) return c.json({ error: 'company_id_required' }, 400)

  const admin = await ensureCompanyAdmin(db, userId, companyId)
  if (!admin) return c.json({ error: 'forbidden' }, 403)

  const { error } = await db.from('company_sefaz_credentials')
    .delete()
    .eq('company_id', companyId)

  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json({ ok: true })
})

// PATCH /api/sefaz-credentials/toggle?company_id=... — ativa ou desativa a integração
router.patch('/toggle', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const companyId = c.req.query('company_id')
  if (!companyId) return c.json({ error: 'company_id_required' }, 400)

  const admin = await ensureCompanyAdmin(db, userId, companyId)
  if (!admin) return c.json({ error: 'forbidden' }, 403)

  const { is_active } = await c.req.json<{ is_active: boolean }>()
  if (typeof is_active !== 'boolean') return c.json({ error: 'validation_error' }, 400)

  const { data, error } = await db.from('company_sefaz_credentials')
    .update({ is_active })
    .eq('company_id', companyId)
    .select('id, environment, uf_code, is_active, last_nsu, last_sync_at, last_error, created_at, updated_at')
    .single()

  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json(data)
})

// POST /api/sefaz-credentials/sync?company_id=... — dispara sincronização manual
router.post('/sync', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const companyId = c.req.query('company_id')
  if (!companyId) return c.json({ error: 'company_id_required' }, 400)

  const admin = await ensureCompanyAdmin(db, userId, companyId)
  if (!admin) return c.json({ error: 'forbidden' }, 403)

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return c.json({ error: 'internal_error' }, 500)

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/sefaz-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ company_id: companyId }),
    })

    const body = await res.json().catch(() => ({}))
    if (!res.ok) return c.json({ error: (body as Record<string, unknown>).error ?? 'sync_failed' }, 502)
    return c.json(body)
  } catch {
    return c.json({ error: 'sync_failed' }, 502)
  }
})

export default router
