/** Tiny CSV helpers for contact import. No extra packages. */

import { upsertInstagramInNotes } from './instagram'

export type CsvContactRow = {
  name: string
  email: string
  company: string
  tag: 'replied' | 'warmed' | null
  notes: string
  nextCallback: string
}

/** Split a whole CSV file into rows of cells (supports quoted newlines). */
function parseCsvRecords(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let cells: string[] = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === '"') {
      if (inQuotes && input[i + 1] === '"') {
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
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && input[i + 1] === '\n') i++
      cells.push(cur.trim())
      cur = ''
      // skip blank lines
      if (cells.some((c) => c.length > 0)) rows.push(cells)
      cells = []
      continue
    }
    cur += ch
  }
  cells.push(cur.trim())
  if (cells.some((c) => c.length > 0)) rows.push(cells)
  return rows
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

function slugForPlaceholder(name: string, social: string): string {
  const fromSocial = social
    .replace(/^https?:\/\/(www\.)?(instagram|facebook)\.com\//i, '')
    .replace(/\/.*/, '')
    .replace(/^@/, '')
    .trim()
  const base = (fromSocial || name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return base || 'lead'
}

/**
 * Expected headers (any order; extras ignored):
 * name, email?, company?, tag? (replied|warmed), notes?, follow_up? (YYYY-MM-DD),
 * instagram?, facebook?, ig_message? / dm? / fb_message?
 * Email can be blank if Instagram or Facebook is present (placeholder email is created).
 * Prefer Instagram when both exist; Facebook fills the same outreach block when IG is blank.
 */
export function parseContactCsv(text: string): { rows: CsvContactRow[]; errors: string[] } {
  const errors: string[] = []
  const records = parseCsvRecords(text)

  if (records.length < 2) {
    return { rows: [], errors: ['CSV needs a header row and at least one person.'] }
  }

  const headers = records[0].map(normHeader)
  const idx = (names: string[]) => headers.findIndex((h) => names.includes(h))

  const nameI = idx(['name', 'full_name', 'contact'])
  const emailI = idx(['email', 'email_address', 'e_mail'])
  const companyI = idx(['company', 'business', 'organisation', 'organization'])
  const tagI = idx(['tag', 'status', 'list', 'type'])
  const notesI = idx(['notes', 'note', 'campaign', 'comment'])
  const followI = idx(['follow_up', 'followup', 'next_callback', 'callback', 'next_follow_up'])
  const igI = idx(['instagram', 'instagram_url', 'ig', 'ig_url', 'instagram_link'])
  const fbI = idx(['facebook', 'facebook_url', 'fb', 'fb_url', 'facebook_link'])
  const dmI = idx([
    'ig_message',
    'instagram_message',
    'dm',
    'dm_message',
    'instagram_dm',
    'ig_dm',
    'fb_message',
    'facebook_message',
    'facebook_dm',
    'fb_dm',
  ])

  if (nameI < 0) {
    return { rows: [], errors: ['CSV must have a name column.'] }
  }
  if (emailI < 0 && igI < 0 && fbI < 0) {
    return { rows: [], errors: ['CSV needs an email column, or Instagram / Facebook.'] }
  }

  const rows: CsvContactRow[] = []
  for (let r = 1; r < records.length; r++) {
    const cells = records[r]
    const name = (cells[nameI] ?? '').trim()
    let email = emailI >= 0 ? (cells[emailI] ?? '').trim().toLowerCase() : ''
    const instagram = igI >= 0 ? (cells[igI] ?? '').trim() : ''
    const facebook = fbI >= 0 ? (cells[fbI] ?? '').trim() : ''
    const igMessage = dmI >= 0 ? (cells[dmI] ?? '').trim() : ''
    const socialUrl = instagram || facebook
    if (!name && !email && !socialUrl) continue
    if (!name) {
      errors.push(`Row ${r + 1}: needs a name.`)
      continue
    }
    if (!email) {
      if (!socialUrl && !igMessage) {
        errors.push(`Row ${r + 1}: needs email (or Instagram / Facebook).`)
        continue
      }
      const prefix = instagram ? 'ig' : 'fb'
      email = `${prefix}-${slugForPlaceholder(name, socialUrl)}@clocal.local`
    } else if (!email.includes('@')) {
      errors.push(`Row ${r + 1}: bad email (${email}).`)
      continue
    }
    const tagRaw = tagI >= 0 ? (cells[tagI] ?? '') : ''
    const tag = pickTag(tagRaw)
    if (tagRaw.trim() && !tag) {
      errors.push(`Row ${r + 1}: tag must be replied or warmed (got "${tagRaw}").`)
    }
    let notes = notesI >= 0 ? (cells[notesI] ?? '').trim() : ''
    if (socialUrl || igMessage) {
      notes = upsertInstagramInNotes(notes, socialUrl, igMessage)
    }
    rows.push({
      name,
      email,
      company: companyI >= 0 ? (cells[companyI] ?? '').trim() : '',
      tag,
      notes,
      nextCallback: followI >= 0 ? (cells[followI] ?? '').trim() : '',
    })
  }

  return { rows, errors }
}
