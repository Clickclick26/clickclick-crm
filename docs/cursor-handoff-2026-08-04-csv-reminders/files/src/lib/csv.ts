/** Tiny CSV helpers for contact import. No extra packages. */

export type CsvContactRow = {
  name: string
  email: string
  company: string
  tag: 'replied' | 'warmed' | null
  notes: string
  nextCallback: string
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      cells.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  cells.push(cur.trim())
  return cells
}

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

function pickTag(raw: string): 'replied' | 'warmed' | null {
  const v = raw.trim().toLowerCase()
  if (!v) return null
  if (v === 'replied' || v === 'reply' || v === 'got_back' || v === 'gotback') return 'replied'
  if (v === 'warmed' || v === 'warm' || v === 'warmed_up' || v === 'warmup') return 'warmed'
  return null
}

/**
 * Expected headers (any order; extras ignored):
 * name, email, company?, tag? (replied|warmed), notes?, follow_up? (YYYY-MM-DD)
 */
export function parseContactCsv(text: string): { rows: CsvContactRow[]; errors: string[] } {
  const errors: string[] = []
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length < 2) {
    return { rows: [], errors: ['CSV needs a header row and at least one person.'] }
  }

  const headers = splitCsvLine(lines[0]).map(normHeader)
  const idx = (names: string[]) => headers.findIndex((h) => names.includes(h))

  const nameI = idx(['name', 'full_name', 'contact'])
  const emailI = idx(['email', 'email_address', 'e_mail'])
  const companyI = idx(['company', 'business', 'organisation', 'organization'])
  const tagI = idx(['tag', 'status', 'list', 'type'])
  const notesI = idx(['notes', 'note', 'campaign', 'comment'])
  const followI = idx(['follow_up', 'followup', 'next_callback', 'callback', 'next_follow_up'])

  if (nameI < 0 || emailI < 0) {
    return { rows: [], errors: ['CSV must have name and email columns.'] }
  }

  const rows: CsvContactRow[] = []
  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r])
    const name = (cells[nameI] ?? '').trim()
    const email = (cells[emailI] ?? '').trim().toLowerCase()
    if (!name && !email) continue
    if (!name || !email) {
      errors.push(`Row ${r + 1}: needs both name and email.`)
      continue
    }
    if (!email.includes('@')) {
      errors.push(`Row ${r + 1}: bad email (${email}).`)
      continue
    }
    const tagRaw = tagI >= 0 ? (cells[tagI] ?? '') : ''
    const tag = pickTag(tagRaw)
    if (tagRaw.trim() && !tag) {
      errors.push(`Row ${r + 1}: tag must be replied or warmed (got "${tagRaw}").`)
    }
    rows.push({
      name,
      email,
      company: companyI >= 0 ? (cells[companyI] ?? '').trim() : '',
      tag,
      notes: notesI >= 0 ? (cells[notesI] ?? '').trim() : '',
      nextCallback: followI >= 0 ? (cells[followI] ?? '').trim() : '',
    })
  }

  return { rows, errors }
}
