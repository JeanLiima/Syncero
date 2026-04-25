export interface ParsedEntryLine {
  account_code: string
  side: 'debit' | 'credit'
  amount: number
  memo: string
}

export interface ParsedEntry {
  entry_date: string
  description: string
  external_ref: string
  lines: ParsedEntryLine[]
  parseError?: boolean
}

// Detects if text uses a known Domínio Contábil CSV export format.
// Domínio exports use semicolon or pipe as delimiter.
function detectDelimiter(line: string): string {
  if (line.includes(';')) return ';'
  if (line.includes('|')) return '|'
  return ','
}

// Parses a date string from Domínio formats: DD/MM/YYYY or YYYY-MM-DD
function parseDate(raw: string): string {
  const trimmed = raw.trim()
  const dmyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`
  const isoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}$/)
  if (isoMatch) return trimmed
  return trimmed
}

// Parses a Brazilian-formatted number: "1.234,56" → 1234.56
function parseBrNumber(raw: string): number {
  const cleaned = raw.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

// Attempts to parse a Domínio Contábil CSV/TXT export into journal entries.
// Each entry header row: date, description, external_ref
// Each line row: account_code, D/C indicator, amount, memo
//
// Expected CSV structure (semicolon-delimited):
//   DATA;HISTORICO;DOCUMENTO;CONTA;DC;VALOR;COMPLEMENTO
//   01/01/2024;Venda de mercadorias;NF001;1.1.1.01;C;10000,00;Caixa
//   01/01/2024;Venda de mercadorias;NF001;4.1.1.01;D;10000,00;Receita
export function parseDominioExport(text: string): ParsedEntry[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length === 0) return []

  const delimiter = detectDelimiter(lines[0])
  const header = lines[0].split(delimiter).map(h => h.trim().toLowerCase())

  // Column index resolution — flexible to common Domínio export layouts
  const colDate = header.findIndex(h => h.includes('data') || h.includes('date'))
  const colDesc = header.findIndex(h => h.includes('hist') || h.includes('descri'))
  const colRef = header.findIndex(h => h.includes('doc') || h.includes('ref') || h.includes('numero'))
  const colAccount = header.findIndex(h => h.includes('conta') || h.includes('account'))
  const colDC = header.findIndex(h => h === 'dc' || h === 'd/c' || h.includes('debito') || h.includes('credito'))
  const colAmount = header.findIndex(h => h.includes('valor') || h.includes('amount'))
  const colMemo = header.findIndex(h => h.includes('compl') || h.includes('memo') || h.includes('obs'))

  if (colDate < 0 || colAccount < 0 || colDC < 0 || colAmount < 0) {
    // Cannot parse — return single error entry
    return [{ entry_date: '', description: 'Formato não reconhecido', external_ref: '', lines: [], parseError: true }]
  }

  // Group rows by (date + description + ref) to reconstruct journal entries
  const entriesMap = new Map<string, ParsedEntry>()

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter)
    if (cols.length <= Math.max(colDate, colAccount, colDC, colAmount)) continue

    const rawDate = cols[colDate]?.trim() ?? ''
    const rawDesc = colDesc >= 0 ? cols[colDesc]?.trim() ?? '' : ''
    const rawRef = colRef >= 0 ? cols[colRef]?.trim() ?? '' : ''
    const rawAccount = cols[colAccount]?.trim() ?? ''
    const rawDC = cols[colDC]?.trim().toUpperCase() ?? ''
    const rawAmount = cols[colAmount]?.trim() ?? ''
    const rawMemo = colMemo >= 0 ? cols[colMemo]?.trim() ?? '' : ''

    const entryKey = `${rawDate}|${rawDesc}|${rawRef}`
    const entryDate = parseDate(rawDate)
    const amount = parseBrNumber(rawAmount)
    const hasError = !rawDate || !rawAccount || (rawDC !== 'D' && rawDC !== 'C') || amount <= 0

    if (!entriesMap.has(entryKey)) {
      entriesMap.set(entryKey, {
        entry_date: entryDate,
        description: rawDesc || `Lançamento ${rawRef}`,
        external_ref: rawRef,
        lines: [],
        parseError: hasError,
      })
    }

    const entry = entriesMap.get(entryKey)!
    if (hasError) {
      entry.parseError = true
    }

    entry.lines.push({
      account_code: rawAccount,
      side: rawDC === 'C' ? 'credit' : 'debit',
      amount,
      memo: rawMemo,
    })
  }

  return Array.from(entriesMap.values())
}
