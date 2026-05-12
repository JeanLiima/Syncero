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

function tag(root: Document | Element, name: string): string {
  return root.getElementsByTagName(name)[0]?.textContent?.trim() ?? ''
}

export function parseNfe(xml: string, companyCnpj: string): NfeParsed | null {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml')

    // DOMParser signals XML errors via a <parsererror> root or documentElement
    if (doc.documentElement.nodeName === 'parsererror') return null
    if (doc.getElementsByTagName('parsererror').length > 0) return null

    if (doc.getElementsByTagName('infNFe').length === 0) return null

    const cnpjIssuer   = stripCnpj(tag(doc, 'emit') ? (doc.getElementsByTagName('emit')[0]?.getElementsByTagName('CNPJ')[0]?.textContent?.trim() ?? '') : '')
    const issuerName   = doc.getElementsByTagName('emit')[0]?.getElementsByTagName('xNome')[0]?.textContent?.trim() ?? ''
    const cnpjRecipient = stripCnpj(doc.getElementsByTagName('dest')[0]?.getElementsByTagName('CNPJ')[0]?.textContent?.trim() ?? '')
    const recipientName = doc.getElementsByTagName('dest')[0]?.getElementsByTagName('xNome')[0]?.textContent?.trim() ?? ''

    const rawDate = tag(doc, 'dhEmi') || tag(doc, 'dEmi')
    const dateMatch = rawDate.match(/(\d{4}-\d{2}-\d{2})/)
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10)

    const rawAmount = tag(doc, 'vNF')
    const amountCents = Math.round(parseFloat(rawAmount || '0') * 100)

    const description = tag(doc, 'natOp')

    const clean = stripCnpj(companyCnpj)
    let type: 'income' | 'expense' | null = null
    let counterpart = ''

    if (clean && cnpjIssuer === clean) {
      type = 'income'
      counterpart = recipientName
    } else if (clean && cnpjRecipient === clean) {
      type = 'expense'
      counterpart = issuerName
    }

    return { type, date, amountCents, counterpart, description, cnpjIssuer, cnpjRecipient, issuerName, recipientName }
  } catch {
    return null
  }
}
