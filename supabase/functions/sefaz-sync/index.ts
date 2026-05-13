// Edge Function: sefaz-sync
// Sincroniza documentos fiscais do SEFAZ DF-e para uma ou todas as empresas com credencial ativa.
// Pode ser chamada via HTTP (POST com { company_id }) ou via pg_cron (sem body = todas as empresas).
//
// Tipos de documento suportados:
//   procNFe        — NF-e autorizada (produtos)
//   procNFSe       — NFS-e (serviços)
//   procCTe        — CT-e (transporte)
//   resNFe         — Resumo de NF-e (sem XML completo, sem destinatário)
//   procEventoNFe  — Eventos: cancela doc já importado quando tpEvento = 110111 / 110112

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

interface CertPem { certChain: string; privateKey: string }

function parsePfx(pfxBytes: Uint8Array, password: string): CertPem {
  const pfxDer  = forge.util.createBuffer(pfxBytes)
  const pfxAsn1 = forge.asn1.fromDer(pfxDer)
  const pfx     = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password)

  const keyBags  = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })
  const keyBag   = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
  const certBag  = certBags[forge.pki.oids.certBag]?.[0]

  if (!keyBag?.key || !certBag?.cert) throw new Error('Certificado ou chave privada não encontrados no PFX')

  return {
    certChain:  forge.pki.certificateToPem(certBag.cert),
    privateKey: forge.pki.privateKeyToPem(keyBag.key),
  }
}

// ── HTTP mTLS sobre TLS ───────────────────────────────────────────────────────

async function sefazPost(hostname: string, path: string, soapBody: string, certChain: string, privateKey: string): Promise<string> {
  const bodyBytes = new TextEncoder().encode(soapBody)
  const requestStr = [
    `POST ${path} HTTP/1.1`,
    `Host: ${hostname}`,
    'Content-Type: application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
    `Content-Length: ${bodyBytes.length}`,
    'Connection: close',
    '', '',
  ].join('\r\n')

  const reqBytes    = new TextEncoder().encode(requestStr)
  const fullRequest = new Uint8Array(reqBytes.length + bodyBytes.length)
  fullRequest.set(reqBytes)
  fullRequest.set(bodyBytes, reqBytes.length)

  // @ts-ignore — Deno.connectTls disponível em Supabase Edge Functions
  const conn = await Deno.connectTls({ hostname, port: 443, certChain, privateKey })
  await conn.write(fullRequest)

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

  const total = chunks.reduce((s, c) => s + c.length, 0)
  const all   = new Uint8Array(total)
  let off = 0
  for (const c of chunks) { all.set(c, off); off += c.length }

  const text      = new TextDecoder('latin1').decode(all)
  const headerEnd = text.indexOf('\r\n\r\n')
  if (headerEnd < 0) throw new Error('Resposta HTTP inválida')

  const headerSection = text.slice(0, headerEnd)
  let body = text.slice(headerEnd + 4)
  if (headerSection.toLowerCase().includes('transfer-encoding: chunked')) body = decodeChunked(body)
  return body
}

function decodeChunked(data: string): string {
  let result = '', pos = 0
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

// ── SOAP ──────────────────────────────────────────────────────────────────────

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

// ── Utilitários XML ───────────────────────────────────────────────────────────

interface SefazDoc { nsu: string; schema: string; xml: string }

interface SefazResponse { cStat: string; xMotivo: string; ultNsu: string; docs: SefazDoc[] }

function qEl(doc: Document, sel: string) {
  return doc.querySelector(sel)?.textContent?.trim() ?? ''
}

function stripNs(xml: string): string {
  return xml
    .replace(/\s+xmlns(?::\w+)?="[^"]*"/g, '')
    .replace(/<(\w+):(\w+)/g, '<$2')
    .replace(/<\/(\w+):(\w+)/g, '</$2')
}

function stripDigits(v: string) { return v.replace(/\D/g, '') }

async function decompressGzip(b64: string): Promise<string> {
  const compressed = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  writer.write(compressed)
  writer.close()
  const parts: Uint8Array[] = []
  const reader = ds.readable.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) parts.push(value)
  }
  const total = parts.reduce((s, p) => s + p.length, 0)
  const all = new Uint8Array(total)
  let off = 0
  for (const p of parts) { all.set(p, off); off += p.length }
  return new TextDecoder('utf-8').decode(all)
}

async function parseSefazResponse(soapXml: string): Promise<SefazResponse> {
  const clean  = stripNs(soapXml)
  const doc    = new DOMParser().parseFromString(clean, 'text/xml')
  const cStat  = qEl(doc, 'cStat')
  const ultNsu = qEl(doc, 'ultNSU')

  const docs: SefazDoc[] = []
  for (const el of Array.from(doc.querySelectorAll('docZip'))) {
    const nsu    = el.getAttribute('NSU')    ?? ''
    const schema = el.getAttribute('schema') ?? ''
    const b64    = el.textContent?.trim()    ?? ''
    try {
      docs.push({ nsu, schema, xml: await decompressGzip(b64) })
    } catch { /* ignora docs que não decomprimem */ }
  }

  return { cStat, xMotivo: qEl(doc, 'xMotivo'), ultNsu, docs }
}

// ── Detecção de schema ────────────────────────────────────────────────────────

type SchemaKind = 'nfe' | 'nfse' | 'cte' | 'resNFe' | 'evento' | 'unknown'

function detectSchema(schema: string): SchemaKind {
  const s = schema.toLowerCase()
  if (s.startsWith('procnfe')  || s.startsWith('nfe_'))       return 'nfe'
  if (s.startsWith('procnfse') || s.startsWith('nfse'))       return 'nfse'
  if (s.startsWith('proccte')  || s.startsWith('cte_'))       return 'cte'
  if (s.startsWith('resnfe'))                                  return 'resNFe'
  if (s.startsWith('proce vento') || s.startsWith('proceventonfe') || s.startsWith('reseventonfe')) return 'evento'
  // fallback: tentar inferir pelo conteúdo do XML
  return 'unknown'
}

// ── Tipos de insert ───────────────────────────────────────────────────────────

interface FiscalDocInsert {
  company_id:     string
  doc_type:       'nfe' | 'nfse' | 'cte'
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
  doc_status:     'authorized' | 'cancelled' | 'denied'
  source:         'sefaz_sync'
  raw_data:       Record<string, unknown>
  counterpart:    string | null
}

function resolveDirection(
  companyCnpj: string,
  issuerCnpj: string,
  recipientCnpj: string,
  issuerName: string,
  recipientName: string,
): { direction: 'income' | 'expense' | null; counterpart: string | null } {
  const clean = stripDigits(companyCnpj)
  if (issuerCnpj === clean)    return { direction: 'income',  counterpart: recipientName || null }
  if (recipientCnpj === clean) return { direction: 'expense', counterpart: issuerName    || null }
  return { direction: null, counterpart: null }
}

// ── Extratores por tipo ───────────────────────────────────────────────────────

function extractNFe(xml: string, companyCnpj: string, nsu: string): FiscalDocInsert | null {
  const doc = new DOMParser().parseFromString(stripNs(xml), 'text/xml')
  if (!doc.querySelector('infNFe')) return null

  const issuerCnpj    = stripDigits(qEl(doc, 'emit CNPJ'))
  const issuerName    = qEl(doc, 'emit xNome')
  const recipientCnpj = stripDigits(qEl(doc, 'dest CNPJ'))
  const recipientName = qEl(doc, 'dest xNome')

  const rawDate = qEl(doc, 'ide dhEmi') || qEl(doc, 'ide dEmi')
  const issueDate = rawDate.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().slice(0, 10)

  const amount    = Math.round(parseFloat(qEl(doc, 'ICMSTot vNF') || '0') * 100) / 100
  const accessKey = doc.querySelector('infNFe')?.getAttribute('Id')?.replace(/^NFe/, '') ?? null
  const cStat     = qEl(doc, 'cStat')

  const { direction, counterpart } = resolveDirection(companyCnpj, issuerCnpj, recipientCnpj, issuerName, recipientName)

  return {
    company_id: companyCnpj,
    doc_type: 'nfe',
    doc_number:     qEl(doc, 'ide nNF') || null,
    series:         qEl(doc, 'ide serie') || null,
    issue_date:     issueDate,
    amount:         amount || null,
    access_key:     accessKey,
    issuer_cnpj:    issuerCnpj  || null,
    issuer_name:    issuerName  || null,
    recipient_cnpj: recipientCnpj || null,
    recipient_name: recipientName || null,
    doc_direction:  direction,
    nsu,
    doc_status:     cStat === '101' || cStat === '135' ? 'cancelled' : 'authorized',
    source:         'sefaz_sync',
    raw_data:       { nsu, schema: 'nfe' },
    counterpart,
  }
}

function extractNFSe(xml: string, companyCnpj: string, nsu: string): FiscalDocInsert | null {
  const doc = new DOMParser().parseFromString(stripNs(xml), 'text/xml')
  if (!doc.querySelector('infNFSe')) return null

  const issuerCnpj    = stripDigits(qEl(doc, 'emit CNPJ') || qEl(doc, 'prest CNPJ'))
  const issuerName    = qEl(doc, 'emit xNome') || qEl(doc, 'prest xNome')
  const recipientCnpj = stripDigits(qEl(doc, 'toma CNPJ'))
  const recipientName = qEl(doc, 'toma xNome')

  const rawDate   = qEl(doc, 'dCompet') || qEl(doc, 'dhEmi')
  const issueDate = rawDate.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().slice(0, 10)

  const rawAmount = qEl(doc, 'valores vLiq') || qEl(doc, 'vServPrest vServ') || qEl(doc, 'vServ') || '0'
  const amount    = Math.round(parseFloat(rawAmount) * 100) / 100

  const { direction, counterpart } = resolveDirection(companyCnpj, issuerCnpj, recipientCnpj, issuerName, recipientName)

  return {
    company_id: companyCnpj,
    doc_type: 'nfse',
    doc_number:     qEl(doc, 'nNFSe') || null,
    series:         null,
    issue_date:     issueDate,
    amount:         amount || null,
    access_key:     null,
    issuer_cnpj:    issuerCnpj  || null,
    issuer_name:    issuerName  || null,
    recipient_cnpj: recipientCnpj || null,
    recipient_name: recipientName || null,
    doc_direction:  direction,
    nsu,
    doc_status:     'authorized',
    source:         'sefaz_sync',
    raw_data:       { nsu, schema: 'nfse' },
    counterpart,
  }
}

function extractCTe(xml: string, companyCnpj: string, nsu: string): FiscalDocInsert | null {
  const doc = new DOMParser().parseFromString(stripNs(xml), 'text/xml')
  if (!doc.querySelector('infCte') && !doc.querySelector('infCTe')) return null

  const infEl = doc.querySelector('infCte') ?? doc.querySelector('infCTe')

  const issuerCnpj    = stripDigits(qEl(doc, 'emit CNPJ'))
  const issuerName    = qEl(doc, 'emit xNome')
  // destinatário pode ser 'dest' ou 'toma' dependendo do modal de CT-e
  const recipientCnpj = stripDigits(qEl(doc, 'dest CNPJ') || qEl(doc, 'toma CNPJ'))
  const recipientName = qEl(doc, 'dest xNome') || qEl(doc, 'toma xNome')

  const rawDate   = qEl(doc, 'ide dhEmi') || qEl(doc, 'ide dEmi')
  const issueDate = rawDate.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().slice(0, 10)

  // vTPrest = valor total da prestação do serviço de transporte
  const amount    = Math.round(parseFloat(qEl(doc, 'vPrest vTPrest') || qEl(doc, 'vTPrest') || '0') * 100) / 100
  const accessKey = infEl?.getAttribute('Id')?.replace(/^CTe/, '') ?? null
  const cStat     = qEl(doc, 'cStat')

  const { direction, counterpart } = resolveDirection(companyCnpj, issuerCnpj, recipientCnpj, issuerName, recipientName)

  return {
    company_id: companyCnpj,
    doc_type: 'cte',
    doc_number:     qEl(doc, 'ide nCT') || null,
    series:         qEl(doc, 'ide serie') || null,
    issue_date:     issueDate,
    amount:         amount || null,
    access_key:     accessKey,
    issuer_cnpj:    issuerCnpj  || null,
    issuer_name:    issuerName  || null,
    recipient_cnpj: recipientCnpj || null,
    recipient_name: recipientName || null,
    doc_direction:  direction,
    nsu,
    doc_status:     cStat === '101' || cStat === '135' ? 'cancelled' : 'authorized',
    source:         'sefaz_sync',
    raw_data:       { nsu, schema: 'cte' },
    counterpart,
  }
}

// resNFe = resumo de NF-e (sem XML completo; CNPJ é sempre o emitente; destinatário não consta)
function extractResNFe(xml: string, companyCnpj: string, nsu: string): FiscalDocInsert | null {
  const doc = new DOMParser().parseFromString(stripNs(xml), 'text/xml')
  if (!doc.querySelector('resNFe')) return null

  const issuerCnpj = stripDigits(qEl(doc, 'CNPJ'))
  const issuerName = qEl(doc, 'xNome')
  const accessKey  = qEl(doc, 'chNFe') || null

  const rawDate   = qEl(doc, 'dhEmi')
  const issueDate = rawDate.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().slice(0, 10)
  const amount    = Math.round(parseFloat(qEl(doc, 'vNF') || '0') * 100) / 100

  const clean2    = stripDigits(companyCnpj)
  const direction: 'income' | 'expense' | null = issuerCnpj === clean2 ? 'income' : 'expense'
  const counterpart = direction === 'income' ? null : issuerName || null

  // cSitNFe: 1=autorizada, 2=cancelada, 3=denegada
  const cSit = qEl(doc, 'cSitNFe')
  const docStatus: FiscalDocInsert['doc_status'] =
    cSit === '2' ? 'cancelled' : cSit === '3' ? 'denied' : 'authorized'

  return {
    company_id: companyCnpj,
    doc_type: 'nfe',
    doc_number:     null,
    series:         null,
    issue_date:     issueDate,
    amount:         amount || null,
    access_key:     accessKey,
    issuer_cnpj:    issuerCnpj || null,
    issuer_name:    issuerName || null,
    recipient_cnpj: null,
    recipient_name: null,
    doc_direction:  direction,
    nsu,
    doc_status:     docStatus,
    source:         'sefaz_sync',
    raw_data:       { nsu, schema: 'resNFe' },
    counterpart,
  }
}

// Retorna a chave de acesso da NF-e cancelada ou null se não for evento de cancelamento
function extractCancellationKey(xml: string): string | null {
  const doc = new DOMParser().parseFromString(stripNs(xml), 'text/xml')
  const tpEvento = qEl(doc, 'tpEvento')
  // 110111 = cancelamento; 110112 = cancelamento por substituição
  if (tpEvento !== '110111' && tpEvento !== '110112') return null
  return qEl(doc, 'chNFe') || null
}

// ── Sincronização de uma empresa ──────────────────────────────────────────────

async function syncCompany(
  db: ReturnType<typeof createClient>,
  cred: {
    id: string; company_id: string
    cert_pfx_enc: string; cert_pfx_iv: string
    cert_password_enc: string; cert_password_iv: string
    environment: string; uf_code: string; last_nsu: string
  },
  company: { cnpj: string },
  encKey: string,
): Promise<{ imported: number; cancelled: number; last_nsu: string; error?: string }> {
  const key = await deriveKey(encKey)
  const pfxBytes  = await decrypt(key, cred.cert_pfx_enc, cred.cert_pfx_iv)
  const passBytes = await decrypt(key, cred.cert_password_enc, cred.cert_password_iv)
  const password  = new TextDecoder().decode(passBytes)

  let certPem: CertPem
  try {
    certPem = parsePfx(pfxBytes, password)
  } catch (err) {
    return { imported: 0, cancelled: 0, last_nsu: cred.last_nsu, error: `Erro ao ler certificado: ${err}` }
  }

  const hostname     = SEFAZ_URLS[cred.environment as keyof typeof SEFAZ_URLS] ?? SEFAZ_URLS.production
  const cnpj         = stripDigits(company.cnpj)
  const soapEnvelope = buildSoapEnvelope(cnpj, cred.uf_code, cred.environment, cred.last_nsu)

  let soapResponse: string
  try {
    soapResponse = await sefazPost(hostname, SEFAZ_PATH, soapEnvelope, certPem.certChain, certPem.privateKey)
  } catch (err) {
    return { imported: 0, cancelled: 0, last_nsu: cred.last_nsu, error: `Erro de conexão SEFAZ: ${err}` }
  }

  let parsed: SefazResponse
  try {
    parsed = await parseSefazResponse(soapResponse)
  } catch (err) {
    return { imported: 0, cancelled: 0, last_nsu: cred.last_nsu, error: `Erro ao parsear resposta: ${err}` }
  }

  // 137 = nenhum documento; 138 = documentos encontrados
  if (parsed.cStat !== '137' && parsed.cStat !== '138') {
    return { imported: 0, cancelled: 0, last_nsu: cred.last_nsu, error: `SEFAZ cStat ${parsed.cStat}: ${parsed.xMotivo}` }
  }

  let imported  = 0
  let cancelled = 0
  const newNsu  = parsed.ultNsu || cred.last_nsu

  // Separa documentos fiscais de eventos de cancelamento
  const fiscalDocs: SefazDoc[]        = []
  const cancellationKeys: string[]    = []

  for (const sefazDoc of parsed.docs) {
    const kind = detectSchema(sefazDoc.schema)

    if (kind === 'evento') {
      const key = extractCancellationKey(sefazDoc.xml)
      if (key) cancellationKeys.push(key)
      continue
    }

    // Tenta inferir pelo conteúdo quando schema não reconhecido
    if (kind === 'unknown') {
      const lower = sefazDoc.xml.toLowerCase()
      if (!lower.includes('infnfe') && !lower.includes('infnfse') && !lower.includes('infcte') && !lower.includes('resnfe')) continue
    }

    fiscalDocs.push(sefazDoc)
  }

  // 1. Upsert dos documentos fiscais
  for (const sefazDoc of fiscalDocs) {
    const kind = detectSchema(sefazDoc.schema)

    let extracted: FiscalDocInsert | null = null
    if (kind === 'nfe'    || kind === 'unknown') extracted = extractNFe(sefazDoc.xml, cnpj, sefazDoc.nsu)
    if (!extracted && (kind === 'nfse'   || kind === 'unknown')) extracted = extractNFSe(sefazDoc.xml, cnpj, sefazDoc.nsu)
    if (!extracted && (kind === 'cte'    || kind === 'unknown')) extracted = extractCTe(sefazDoc.xml, cnpj, sefazDoc.nsu)
    if (!extracted && kind === 'resNFe')                         extracted = extractResNFe(sefazDoc.xml, cnpj, sefazDoc.nsu)
    if (!extracted) continue

    const insert = { ...extracted, company_id: cred.company_id }

    const { error } = await db.from('fiscal_documents')
      .upsert(insert, { onConflict: extracted.access_key ? 'access_key' : 'id', ignoreDuplicates: true })
    if (!error) imported++
  }

  // 2. Aplica eventos de cancelamento em documentos já importados
  for (const accessKey of cancellationKeys) {
    const { error } = await db.from('fiscal_documents')
      .update({ doc_status: 'cancelled' })
      .eq('company_id', cred.company_id)
      .eq('access_key', accessKey)
      .neq('doc_status', 'cancelled') // evita update desnecessário
    if (!error) cancelled++
  }

  return { imported, cancelled, last_nsu: newNsu }
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

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  let body: { company_id?: string } = {}
  try { body = await req.json() } catch { /* sem body = todas as empresas */ }

  let credQuery = db.from('company_sefaz_credentials')
    .select('id, company_id, cert_pfx_enc, cert_pfx_iv, cert_password_enc, cert_password_iv, environment, uf_code, last_nsu, companies!inner(cnpj)')
    .eq('is_active', true)

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

    const { imported, cancelled, last_nsu, error } =
      await syncCompany(db, cred as Parameters<typeof syncCompany>[2], company, encKey)

    await db.from('company_sefaz_credentials').update({
      last_nsu,
      last_sync_at: new Date().toISOString(),
      last_error:   error ?? null,
    }).eq('id', cred.id)

    results.push({ company_id: cred.company_id, imported, cancelled, last_nsu, error: error ?? null })
  }

  return new Response(JSON.stringify({ results }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
