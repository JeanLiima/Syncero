export interface OFXTransaction {
  fitId: string
  date: string
  amountCents: number
  type: 'income' | 'expense'
  counterpart: string
  description: string
}

function parseOFXDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length < 8) return new Date().toISOString().slice(0, 10)
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

function sgmlValue(block: string, tag: string): string {
  const re = new RegExp(`<${tag}>([^<\n\r]*)`, 'i')
  return block.match(re)?.[1]?.trim() ?? ''
}

function parseSGML(content: string): OFXTransaction[] {
  const results: OFXTransaction[] = []
  const blockRe = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|$)/gi
  let match: RegExpExecArray | null
  while ((match = blockRe.exec(content)) !== null) {
    const block = match[1]
    const rawAmount = sgmlValue(block, 'TRNAMT')
    const amount = parseFloat(rawAmount)
    if (isNaN(amount) || amount === 0) continue
    const name = sgmlValue(block, 'NAME')
    const memo = sgmlValue(block, 'MEMO')
    results.push({
      fitId: sgmlValue(block, 'FITID') || crypto.randomUUID(),
      date: parseOFXDate(sgmlValue(block, 'DTPOSTED')),
      amountCents: Math.round(Math.abs(amount) * 100),
      type: amount > 0 ? 'income' : 'expense',
      counterpart: name,
      description: memo || name,
    })
  }
  return results
}

function parseXML(content: string): OFXTransaction[] {
  const doc = new DOMParser().parseFromString(content, 'text/xml')
  const transactions = doc.querySelectorAll('STMTTRN')
  const results: OFXTransaction[] = []
  transactions.forEach((txn) => {
    const getText = (tag: string) => txn.querySelector(tag)?.textContent?.trim() ?? ''
    const rawAmount = getText('TRNAMT')
    const amount = parseFloat(rawAmount)
    if (isNaN(amount) || amount === 0) return
    const name = getText('NAME')
    const memo = getText('MEMO')
    results.push({
      fitId: getText('FITID') || crypto.randomUUID(),
      date: parseOFXDate(getText('DTPOSTED')),
      amountCents: Math.round(Math.abs(amount) * 100),
      type: amount > 0 ? 'income' : 'expense',
      counterpart: name,
      description: memo || name,
    })
  })
  return results
}

export function parseOFX(content: string): OFXTransaction[] {
  const trimmed = content.trimStart()
  if (trimmed.startsWith('OFXHEADER:') || trimmed.startsWith('<OFX')) {
    return trimmed.startsWith('OFXHEADER:') ? parseSGML(content) : parseXML(content)
  }
  // try both
  const sgml = parseSGML(content)
  return sgml.length > 0 ? sgml : parseXML(content)
}
