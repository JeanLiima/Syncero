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

function getText(el: Element | null): string {
  return el?.textContent?.trim() ?? ''
}

export function parseNfe(xml: string, companyCnpj: string): NfeParsed | null {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml')
    const parseError = doc.querySelector('parsererror')
    if (parseError) return null

    const infNFe = doc.querySelector('infNFe')
    if (!infNFe) return null

    const cnpjIssuer = stripCnpj(getText(infNFe.querySelector('emit > CNPJ')))
    const cnpjRecipient = stripCnpj(getText(infNFe.querySelector('dest > CNPJ')))
    const issuerName = getText(infNFe.querySelector('emit > xNome'))
    const recipientName = getText(infNFe.querySelector('dest > xNome'))

    const rawDate = getText(infNFe.querySelector('ide > dhEmi')) || getText(infNFe.querySelector('ide > dEmi'))
    const dateMatch = rawDate.match(/(\d{4}-\d{2}-\d{2})/)
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10)

    const rawAmount = getText(infNFe.querySelector('total > ICMSTot > vNF'))
    const amountCents = Math.round(parseFloat(rawAmount || '0') * 100)

    const description = getText(infNFe.querySelector('ide > natOp'))

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
