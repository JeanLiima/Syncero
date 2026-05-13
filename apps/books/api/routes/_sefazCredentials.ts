import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

// Verifica acesso do contador à empresa interna
async function ensureAccountantOfCompany(
  db: ReturnType<typeof createServiceClient>,
  userId: string,
  companyId: string,
) {
  const { data } = await db.from('accountant_companies')
    .select('id')
    .eq('accountant_id', userId)
    .eq('company_id', companyId)
    .eq('status', 'accepted')
    .maybeSingle()
  return !!data
}

// Verifica que a empresa externa pertence ao contador
async function ensureOwnsExtCompany(
  db: ReturnType<typeof createServiceClient>,
  userId: string,
  extCompanyId: string,
) {
  const { data } = await db.from('external_companies')
    .select('id')
    .eq('id', extCompanyId)
    .eq('accountant_id', userId)
    .maybeSingle()
  return !!data
}

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
    iv:  btoa(String.fromCharCode(...iv)),
  }
}

const SELECT_FIELDS = 'id, environment, uf_code, is_active, last_nsu, last_sync_at, last_error, created_at, updated_at'

// GET /api/sefaz-credentials?company_id=... ou ?ext_company_id=...
router.get('/', async (c) => {
  const userId      = c.get('userId')
  const db          = createServiceClient()
  const companyId    = c.req.query('company_id')
  const extCompanyId = c.req.query('ext_company_id')

  if (!companyId && !extCompanyId) return c.json({ error: 'company_id ou ext_company_id obrigatório' }, 400)

  if (companyId) {
    const ok = await ensureAccountantOfCompany(db, userId, companyId)
    if (!ok) return c.json({ error: 'forbidden' }, 403)
    const { data } = await db.from('company_sefaz_credentials')
      .select(SELECT_FIELDS).eq('company_id', companyId).maybeSingle()
    return c.json(data ?? null)
  }

  const ok = await ensureOwnsExtCompany(db, userId, extCompanyId!)
  if (!ok) return c.json({ error: 'forbidden' }, 403)
  const { data } = await db.from('company_sefaz_credentials')
    .select(SELECT_FIELDS).eq('ext_company_id', extCompanyId!).maybeSingle()
  return c.json(data ?? null)
})

// POST /api/sefaz-credentials — empresa externa (ext_company_id) ou interna vinculada (company_id)
router.post('/', async (c) => {
  const userId = c.get('userId')
  const db     = createServiceClient()

  const encKey = process.env.SEFAZ_CERT_KEY
  if (!encKey) return c.json({ error: 'SEFAZ_CERT_KEY não configurado' }, 500)

  let form: FormData
  try { form = await c.req.formData() }
  catch { return c.json({ error: 'Esperado multipart/form-data' }, 400) }

  const companyId    = form.get('company_id')    as string | null
  const extCompanyId = form.get('ext_company_id') as string | null
  const password     = form.get('password')       as string | null
  const environment  = (form.get('environment')   as string | null) ?? 'production'
  const ufCode       = form.get('uf_code')        as string | null
  const certFile     = form.get('cert')           as File | null

  if (!companyId && !extCompanyId) return c.json({ error: 'company_id ou ext_company_id obrigatório' }, 400)
  if (!password)  return c.json({ error: 'password obrigatório' }, 400)
  if (!ufCode)    return c.json({ error: 'uf_code obrigatório' }, 400)
  if (!certFile)  return c.json({ error: 'cert obrigatório' }, 400)
  if (!['production', 'homologation'].includes(environment)) return c.json({ error: 'environment inválido' }, 400)

  if (companyId) {
    const ok = await ensureAccountantOfCompany(db, userId, companyId)
    if (!ok) return c.json({ error: 'forbidden' }, 403)
  } else {
    const ok = await ensureOwnsExtCompany(db, userId, extCompanyId!)
    if (!ok) return c.json({ error: 'forbidden' }, 403)
  }

  const pfxBytes = new Uint8Array(await certFile.arrayBuffer())
  const key      = await deriveKey(encKey)
  const { enc: certEnc, iv: certIv } = await encrypt(key, pfxBytes)
  const { enc: passEnc, iv: passIv } = await encrypt(key, new TextEncoder().encode(password))

  const payload = companyId
    ? { company_id: companyId, accountant_id: userId }
    : { ext_company_id: extCompanyId!, accountant_id: userId }

  const { data, error } = await db.from('company_sefaz_credentials')
    .upsert({
      ...payload,
      cert_pfx_enc:      certEnc,
      cert_pfx_iv:       certIv,
      cert_password_enc: passEnc,
      cert_password_iv:  passIv,
      environment,
      uf_code:           ufCode,
      last_nsu:          '000000000000000',
      last_error:        null,
      last_sync_at:      null,
      is_active:         true,
    }, { onConflict: companyId ? 'company_id' : 'ext_company_id' })
    .select(SELECT_FIELDS)
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

// DELETE /api/sefaz-credentials?company_id=... ou ?ext_company_id=...
router.delete('/', async (c) => {
  const userId       = c.get('userId')
  const db           = createServiceClient()
  const companyId    = c.req.query('company_id')
  const extCompanyId = c.req.query('ext_company_id')

  if (!companyId && !extCompanyId) return c.json({ error: 'company_id ou ext_company_id obrigatório' }, 400)

  if (companyId) {
    const ok = await ensureAccountantOfCompany(db, userId, companyId)
    if (!ok) return c.json({ error: 'forbidden' }, 403)
    const { error } = await db.from('company_sefaz_credentials').delete().eq('company_id', companyId)
    if (error) return c.json({ error: error.message }, 500)
  } else {
    const ok = await ensureOwnsExtCompany(db, userId, extCompanyId!)
    if (!ok) return c.json({ error: 'forbidden' }, 403)
    const { error } = await db.from('company_sefaz_credentials').delete().eq('ext_company_id', extCompanyId!)
    if (error) return c.json({ error: error.message }, 500)
  }

  return c.json({ ok: true })
})

// PATCH /api/sefaz-credentials/toggle — empresa externa ou interna vinculada
router.patch('/toggle', async (c) => {
  const userId       = c.get('userId')
  const db           = createServiceClient()
  const companyId    = c.req.query('company_id')
  const extCompanyId = c.req.query('ext_company_id')

  if (!companyId && !extCompanyId) return c.json({ error: 'company_id ou ext_company_id obrigatório' }, 400)

  if (companyId) {
    const ok = await ensureAccountantOfCompany(db, userId, companyId)
    if (!ok) return c.json({ error: 'forbidden' }, 403)
  } else {
    const ok = await ensureOwnsExtCompany(db, userId, extCompanyId!)
    if (!ok) return c.json({ error: 'forbidden' }, 403)
  }

  const { is_active } = await c.req.json<{ is_active: boolean }>()
  if (typeof is_active !== 'boolean') return c.json({ error: 'is_active deve ser boolean' }, 400)

  const col = companyId ? 'company_id' : 'ext_company_id'
  const val = companyId ? companyId    : extCompanyId!

  const { data, error } = await db.from('company_sefaz_credentials')
    .update({ is_active })
    .eq(col, val)
    .select(SELECT_FIELDS)
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

// POST /api/sefaz-credentials/sync — aceita company_id (interna) ou ext_company_id (externa)
router.post('/sync', async (c) => {
  const userId       = c.get('userId')
  const db           = createServiceClient()
  const companyId    = c.req.query('company_id')
  const extCompanyId = c.req.query('ext_company_id')

  if (!companyId && !extCompanyId) return c.json({ error: 'company_id ou ext_company_id obrigatório' }, 400)

  if (companyId) {
    const ok = await ensureAccountantOfCompany(db, userId, companyId)
    if (!ok) return c.json({ error: 'forbidden' }, 403)
  } else {
    const ok = await ensureOwnsExtCompany(db, userId, extCompanyId!)
    if (!ok) return c.json({ error: 'forbidden' }, 403)
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return c.json({ error: 'Supabase não configurado' }, 500)

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/sefaz-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify(companyId ? { company_id: companyId } : { ext_company_id: extCompanyId }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return c.json({ error: (body as Record<string, unknown>).error ?? 'Sync falhou' }, 502)
    return c.json(body)
  } catch (err) {
    return c.json({ error: String(err) }, 502)
  }
})

export default router
