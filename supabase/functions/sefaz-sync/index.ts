// Edge Function: sefaz-sync
// Sincroniza documentos fiscais do SEFAZ DF-e para uma ou todas as empresas com credencial ativa.
// Pode ser chamada via HTTP (POST com { company_id }) ou via pg_cron (sem body = todas as empresas).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore — npm: import em Deno Deploy
import forge from 'npm:node-forge@1.3.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const SEFAZ_URLS = {
  production:   'www1.nfe.fazenda.gov.br',
  homologation: 'hom1.nfe.fazenda.gov.br',
}

const SEFAZ_PATH = '/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'

// ── Criptografia ──────────────────────────────────────────────────────────────

async function deriveKey(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt'])
}

async function decrypt(key: CryptoKey, encB64: string, ivB64: string): Promise<Uint8Array> {
  const enc = Uint8Array.from(atob(encB64), (c) => c.charCodeAt(0))
  const iv  = Uint8Array.from(atob(ivB64),  (c) => c.charCodeAt(0))
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, enc)
  return new Uint8Array(plain)
}

// ── Parsing do certificado PFX ────────────────────────────────────────────────

interface CertPem {
  certChain: string
  privateKey: string
}

function parsePfx(pfxBytes: Uint8Array, password: string): CertPem {
  const pfxDer  = forge.util.createBuffer(pfxBytes)
  const pfxAsn1 = forge.asn1.fromDer(pfxDer)
  const pfx     = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password)

  const keyBags  = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })

  const keyBag  = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
  const certBag = certBags[forge.pki.oids.certBag]?.[0]

  if (!keyBag?.key || !certBag?.cert) {
    throw new Error('Certificado ou chave privada não encontrados no PFX')
  }

  return {
    certChain:  forge.pki.certificateToPem(certBag.cert),
    privateKey: forge.pki.privateKeyToPem(keyBag.key),
  }
}

// ── HTTP sobre TLS com certificado de cliente (mTLS) ─────────────────────────

async function sefazPost(
  hostname: string,
  path: string,
  soapBody: string,
  certChain: string,
  privateKey: string,
): Promise<string> {
  const bodyBytes = new TextEncoder().encode(soapBody)

  const requestStr = [
    `POST ${path} HTTP/1.1`,
    `Host: ${hostname}`,
    'Content-Type: application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
    `Content-Length: ${bodyBytes.length}`,
    'Connection: close',
    '',
    '',
  ].join('\r\n')

  const reqBytes    = new TextEncoder().encode(requestStr)
  const fullRequest = new Uint8Array(reqBytes.length + bodyBytes.length)
  fullRequest.set(reqBytes)
  fullRequest.set(bodyBytes, reqBytes.length)

  // @ts-ignore — Deno.connectTls disponível em Supabase Edge Functions
  const conn = await Deno.connectTls({ hostname, port: 443, certChain, privateKey })

  await conn.write(fullRequest)

  // Lê a resposta completa
  const chunks: Uint8Array[] = []
  const buf = new Uint8Array(65536)
  while (true) {
    try {
      const n = await conn.read(buf)
      if (n === null) break
      chunks.push(new Uint8Array(buf.slice(0, n)))
    } catch { break }
  }
  conn.close()

  // Combina chunks
  const total = chunks.reduce((s, c) => s + c.length, 0)
  const all   = new Uint8Array(total)
  let offset  = 0
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length }

  const text      = new TextDecoder('latin1').decode(all)
  const headerEnd = text.indexOf('\r\n\r\n')
  if (headerEnd < 0) throw new Error('Resposta HTTP inválida')

  const headerSection = text.slice(0, headerEnd)
  let bodySection     = text.slice(headerEnd + 4)

  // Decodifica chunked transfer encoding se necessário
  const isChunked = headerSection.toLowerCase().includes('transfer-encoding: chunked')
  if (isChunked) bodySection = decodeChunked(bodySection)

  return bodySection
}

function decodeChunked(data: string): string {
  let result = ''
  let pos    = 0
  while (pos < data.length) {
    const crlfPos = data.indexOf('\r\n', pos)
    if (crlfPos < 0) break
    const size = parseInt(data.slice(pos, crlfPos).trim(), 16)
    if (isNaN(size) || size === 0) break
    pos = crlfPos + 2
    result += data.slice(pos, pos + size)
    pos += size + 2
  }
  return result
}

// ── SOAP payload ─────────────────────────────────────────────────────────────

function buildSoapEnvelope(cnpj: string, ufCode: string, environment: string, lastNsu: string): string {
  const tpAmb = environment === 'production' ? '1' : '2'
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                 xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>${tpAmb}</tpAmb>
          <cUFAutor>${ufCode}</cUFAutor>
          <CNPJ>${cnpj}</CNPJ>
          <distNSU>
            <ultNSU>${lastNsu.padStart(15, '0')}</ultNSU>
          </distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`
}

// ── Parsing da resposta SEFAZ ─────────────────────────────────────────────────

interface SefazDoc {
  nsu: string
  schema: string
  xml: string
}

interface SefazResponse {
  cStat: string
  xMotivo: string
  ultNsu: string
  docs: SefazDoc[]
}

function q(node: Element | Document, selector: string): string {
  return node.querySelector(selector)?.textContent?.trim() ?? ''
}

function stripNs(xml: string): string {
  return xml.replace(/\s+xmlns(?::\w+)?="[^"]*"/g, '').replace(/<(\w+):(\w+)/g, '<$2').replace(/<\/(\w+):(\w+)/g, '</$2')
}

async function decompressGzip(b64: string): Promise<string> {
  const compressed = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const ds         = new DecompressionStream('gzip')
  const writer     = ds.writable.getWriter()
  writer.write(compressed)
  writer.close()
  const reader = ds.readable.getReader()
  const parts: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) parts.push(value)
  }
  const total = parts.reduce((s, p) => s + p.length, 0)
  const all   = new Uint8Array(total)
  let off = 0
  for (const p of parts) { all.set(p, off); off += p.length }
  return new TextDecoder('utf-8').decode(all)
}

async function parseSefazResponse(soapXml: string): Promise<SefazResponse> {
  const clean  = stripNs(soapXml)
  const parser = new DOMParser()
  const doc    = parser.parseFromString(clean, 'text/xml')

  const cStat   = q(doc, 'cStat')
  const xMotivo = q(doc, 'xMotivo')
  const ultNsu  = q(doc, 'ultNSU')

  const docZipEls = Array.from(doc.querySelectorAll('docZip'))
  const docs: SefazDoc[] = []

  for (const el of docZipEls) {
    const nsu    = el.getAttribute('NSU')    ?? ''
    const schema = el.getAttribute('schema') ?? ''
    const b64    = el.textContent?.trim()    ?? ''
    try {
      const xml = await decompressGzip(b64)
      docs.push({ nsu, schema, xml })
    } catch {
      // Ignora documentos que não conseguiram descomprimir
    }
  }

  return { cStat, xMotivo, ultNsu, docs }
}

// ── Extração de campos dos XMLs de NF-e ──────────────────────────────────────

interface FiscalDocInsert {
  company_id:     string
  doc_type:       string
  doc_number:     string | null
  series:         string | null
  issue_date:     string
  amount:         number | null
  access_key:     string | null
  issuer_cnpj:    string | null
  issuer_name:    string | null
  recipient_cnpj: string | null
  recipient_name: string | null
  doc_direction:  'income' | 'expense' | null
  nsu:            string
  doc_status:     'authorized' | 'cancelled'
  source:         'sefaz_sync'
  raw_data:       Record<string, unknown>
  counterpart:    string | null
}

function stripDigits(v: string) { return v.replace(/\D/g, '') }

function qEl(doc: Document, sel: string) {
  return doc.querySelector(sel)?.textContent?.trim() ?? ''
}

function extractNfe(xml: string, companyCnpj: string, nsu: string): FiscalDocInsert | null {
  const clean  = stripNs(xml)
  const parser = new DOMParser()
  const doc    = parser.parseFromString(clean, 'text/xml')

  const isNfe  = !!doc.querySelector('infNFe')
  const isNfse = !isNfe && !!doc.querySelector('infNFSe')
  if (!isNfe && !isNfse) return null

  const accessKey    = qEl(doc, 'infNFe')  ? (doc.querySelector('infNFe')?.getAttribute('Id')?.replace(/^NFe/, '') ?? null)
                     : null
  const docNumber    = isNfe ? qEl(doc, 'ide nNF')  : qEl(doc, 'nNFSe')
  const series       = isNfe ? qEl(doc, 'ide serie') : null
  const rawDate      = isNfe
    ? (qEl(doc, 'ide dhEmi') || qEl(doc, 'ide dEmi'))
    : (qEl(doc, 'dCompet')   || qEl(doc, 'dhEmi'))
  const dateMatch    = rawDate.match(/(\d{4}-\d{2}-\d{2})/)
  const issueDate    = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10)

  const issuerCnpj   = isNfe ? stripDigits(qEl(doc, 'emit CNPJ'))
                     : stripDigits(qEl(doc, 'emit CNPJ') || qEl(doc, 'prest CNPJ'))
  const issuerName   = isNfe ? qEl(doc, 'emit xNome')
                     : (qEl(doc, 'emit xNome') || qEl(doc, 'prest xNome'))
  const recipientCnpj = isNfe ? stripDigits(qEl(doc, 'dest CNPJ'))
                      : stripDigits(qEl(doc, 'toma CNPJ'))
  const recipientName = isNfe ? qEl(doc, 'dest xNome')
                      : qEl(doc, 'toma xNome')

  const rawAmount    = isNfe
    ? (qEl(doc, 'ICMSTot vNF') || '0')
    : (qEl(doc, 'valores vLiq') || qEl(doc, 'vServPrest vServ') || qEl(doc, 'vServ') || '0')
  const amount = Math.round(parseFloat(rawAmount) * 100) / 100

  const clean2 = stripDigits(companyCnpj)
  const direction: 'income' | 'expense' | null =
    issuerCnpj === clean2   ? 'income'  :
    recipientCnpj === clean2 ? 'expense' : null

  const counterpart = direction === 'income' ? recipientName : issuerName

  // Detecta se é cancelamento
  const cStat     = qEl(doc, 'cStat')
  const docStatus: 'authorized' | 'cancelled' = cStat === '101' || cStat === '135' ? 'cancelled' : 'authorized'

  return {
    company_id:     companyCnpj, // será substituído pelo company_id real
    doc_type:       isNfe ? 'nfe' : 'nfse',
    doc_number:     docNumber || null,
    series:         series || null,
    issue_date:     issueDate,
    amount:         amount || null,
    access_key:     accessKey,
    issuer_cnpj:    issuerCnpj || null,
    issuer_name:    issuerName || null,
    recipient_cnpj: recipientCnpj || null,
    recipient_name: recipientName || null,
    doc_direction:  direction,
    nsu,
    doc_status:     docStatus,
    source:         'sefaz_sync',
    raw_data:       { nsu, schema: 'nfe' },
    counterpart:    counterpart || null,
  }
}

// ── Sincronização de uma empresa ──────────────────────────────────────────────

async function syncCompany(
  db: ReturnType<typeof createClient>,
  cred: {
    id: string
    company_id: string
    cert_pfx_enc: string
    cert_pfx_iv: string
    cert_password_enc: string
    cert_password_iv: string
    environment: string
    uf_code: string
    last_nsu: string
  },
  company: { cnpj: string },
  encKey: string,
): Promise<{ imported: number; last_nsu: string; error?: string }> {
  const key = await deriveKey(encKey)

  // Decripta PFX e senha
  const pfxBytes  = await decrypt(key, cred.cert_pfx_enc, cred.cert_pfx_iv)
  const passBytes = await decrypt(key, cred.cert_password_enc, cred.cert_password_iv)
  const password  = new TextDecoder().decode(passBytes)

  let certPem: CertPem
  try {
    certPem = parsePfx(pfxBytes, password)
  } catch (err) {
    return { imported: 0, last_nsu: cred.last_nsu, error: `Erro ao ler certificado: ${err}` }
  }

  const hostname   = SEFAZ_URLS[cred.environment as keyof typeof SEFAZ_URLS] ?? SEFAZ_URLS.production
  const cnpj       = stripDigits(company.cnpj)
  const soapEnvelope = buildSoapEnvelope(cnpj, cred.uf_code, cred.environment, cred.last_nsu)

  let soapResponse: string
  try {
    soapResponse = await sefazPost(hostname, SEFAZ_PATH, soapEnvelope, certPem.certChain, certPem.privateKey)
  } catch (err) {
    return { imported: 0, last_nsu: cred.last_nsu, error: `Erro de conexão SEFAZ: ${err}` }
  }

  let parsed: SefazResponse
  try {
    parsed = await parseSefazResponse(soapResponse)
  } catch (err) {
    return { imported: 0, last_nsu: cred.last_nsu, error: `Erro ao parsear resposta: ${err}` }
  }

  // 137 = nenhum documento, 138 = documentos encontrados
  if (parsed.cStat !== '138' && parsed.cStat !== '137') {
    return { imported: 0, last_nsu: cred.last_nsu, error: `SEFAZ retornou cStat ${parsed.cStat}: ${parsed.xMotivo}` }
  }

  let imported = 0
  const newNsu = parsed.ultNsu || cred.last_nsu

  for (const sefazDoc of parsed.docs) {
    // Ignora schemas que não são NF-e ou NFS-e (ex: resumos, eventos)
    const isNfeSchema = sefazDoc.schema.startsWith('procNFe') || sefazDoc.schema.startsWith('nfe')
    const isNfseSchema = sefazDoc.schema.startsWith('procNFSe') || sefazDoc.schema.startsWith('nfse')
    if (!isNfeSchema && !isNfseSchema) continue

    const extracted = extractNfe(sefazDoc.xml, cnpj, sefazDoc.nsu)
    if (!extracted) continue

    const insert: Record<string, unknown> = {
      ...extracted,
      company_id: cred.company_id,
    }

    // Upsert por access_key (se disponível) ou por nsu
    const { error: upsertErr } = await db.from('fiscal_documents')
      .upsert(insert, {
        onConflict: extracted.access_key ? 'access_key' : 'id',
        ignoreDuplicates: true,
      })

    if (!upsertErr) imported++
  }

  return { imported, last_nsu: newNsu }
}

// ── Entry point ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const encKey = Deno.env.get('SEFAZ_CERT_KEY')
  if (!encKey) {
    return new Response(JSON.stringify({ error: 'SEFAZ_CERT_KEY não configurado' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Determina quais empresas sincronizar
  let body: { company_id?: string } = {}
  try { body = await req.json() } catch { /* sem body = todas as empresas */ }

  let credQuery = db.from('company_sefaz_credentials')
    .select(`
      id, company_id, cert_pfx_enc, cert_pfx_iv, cert_password_enc, cert_password_iv,
      environment, uf_code, last_nsu,
      companies!inner(cnpj)
    `)

  if (body.company_id) credQuery = credQuery.eq('company_id', body.company_id)

  const { data: creds, error: credsErr } = await credQuery
  if (credsErr) {
    return new Response(JSON.stringify({ error: credsErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const results: Record<string, unknown>[] = []

  for (const cred of creds ?? []) {
    const company = (cred as Record<string, unknown>).companies as { cnpj: string }
    if (!company?.cnpj) {
      results.push({ company_id: cred.company_id, error: 'Empresa sem CNPJ cadastrado' })
      continue
    }

    const { imported, last_nsu, error } = await syncCompany(db, cred as Parameters<typeof syncCompany>[2], company, encKey)

    // Atualiza NSU e status da última sincronização
    await db.from('company_sefaz_credentials').update({
      last_nsu,
      last_sync_at: new Date().toISOString(),
      last_error:   error ?? null,
    }).eq('id', cred.id)

    results.push({ company_id: cred.company_id, imported, last_nsu, error: error ?? null })
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
