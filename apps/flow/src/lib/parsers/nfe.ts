export interface NfeParsed {
  type: 'income' | 'expense' | null
  date: string
  amountCents: number
  counterpart: string
  description: string
  cnpjIssuer: string
  cnpjRecipient: string
  issuerName: string
  recipientName: string
}

function stripCnpj(v: string) {
  return v.replace(/\D/g, '')
}

function q(root: Document | Element, selector: string): string {
  return root.querySelector(selector)?.textContent?.trim() ?? ''
}

function removeNamespaces(xml: string): string {
  const bom = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml
  return bom.replace(/\s+xmlns(?::\w+)?="[^"]*"/g, '')
}

function resolveType(
  companyCnpj: string,
  cnpjIssuer: string,
  cnpjRecipient: string,
  issuerName: string,
  recipientName: string,
): { type: 'income' | 'expense' | null; counterpart: string } {
  const clean = stripCnpj(companyCnpj)
  if (clean && cnpjIssuer === clean) return { type: 'income',  counterpart: recipientName }
  if (clean && cnpjRecipient === clean) return { type: 'expense', counterpart: issuerName }
  return { type: null, counterpart: '' }
}

// ── NFe (SEFAZ — produtos e serviços estaduais) ──────────────────────────────

function parseAsNFe(doc: Document, companyCnpj: string): NfeParsed | null {
  if (!doc.querySelector('infNFe')) return null

  const cnpjIssuer    = stripCnpj(q(doc, 'emit CNPJ'))
  const issuerName    = q(doc, 'emit xNome')
  const cnpjRecipient = stripCnpj(q(doc, 'dest CNPJ'))
  const recipientName = q(doc, 'dest xNome')

  const rawDate   = q(doc, 'ide dhEmi') || q(doc, 'ide dEmi')
  const dateMatch = rawDate.match(/(\d{4}-\d{2}-\d{2})/)
  const date      = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10)

  const amountCents = Math.round(parseFloat(q(doc, 'ICMSTot vNF') || '0') * 100)
  const description = q(doc, 'ide natOp')

  const { type, counterpart } = resolveType(companyCnpj, cnpjIssuer, cnpjRecipient, issuerName, recipientName)

  return { type, date, amountCents, counterpart, description, cnpjIssuer, cnpjRecipient, issuerName, recipientName }
}

// ── NFSe (Receita Federal — padrão nacional de serviços) ─────────────────────

function parseAsNFSe(doc: Document, companyCnpj: string): NfeParsed | null {
  if (!doc.querySelector('infNFSe')) return null

  const cnpjIssuer    = stripCnpj(q(doc, 'emit CNPJ') || q(doc, 'prest CNPJ'))
  const issuerName    = q(doc, 'emit xNome') || q(doc, 'prest xNome')
  const cnpjRecipient = stripCnpj(q(doc, 'toma CNPJ'))
  const recipientName = q(doc, 'toma xNome')

  // dCompet → competency date; fall back to dhEmi or dhProc
  const rawDate   = q(doc, 'dCompet') || q(doc, 'dhEmi') || q(doc, 'dhProc')
  const dateMatch = rawDate.match(/(\d{4}-\d{2}-\d{2})/)
  const date      = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10)

  // vLiq = valor líquido; fallback to vServ
  const rawAmount   = q(doc, 'valores vLiq') || q(doc, 'vServPrest vServ') || q(doc, 'vServ')
  const amountCents = Math.round(parseFloat(rawAmount || '0') * 100)

  const description = q(doc, 'xDescServ') || q(doc, 'xTribNac') || q(doc, 'xNBS')

  const { type, counterpart } = resolveType(companyCnpj, cnpjIssuer, cnpjRecipient, issuerName, recipientName)

  return { type, date, amountCents, counterpart, description, cnpjIssuer, cnpjRecipient, issuerName, recipientName }
}

// ── Entry point ──────────────────────────────────────────────────────────────

export function parseNfe(xml: string, companyCnpj: string): NfeParsed | null {
  try {
    const clean = removeNamespaces(xml)
    const doc   = new DOMParser().parseFromString(clean, 'text/xml')

    if (
      doc.documentElement.nodeName === 'parsererror' ||
      doc.querySelector('parsererror') !== null
    ) return null

    return parseAsNFe(doc, companyCnpj) ?? parseAsNFSe(doc, companyCnpj)
  } catch {
    return null
  }
}
