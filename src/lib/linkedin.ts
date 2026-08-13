/** LinkedIn URL stored inside contact notes (no DB migration). */

const START = '---LINKEDIN---'
const END = '---END-LINKEDIN---'

export function parseLinkedinUrl(notes: string): string {
  if (!notes) return ''
  const start = notes.indexOf(START)
  if (start < 0) return ''
  const end = notes.indexOf(END, start)
  if (end < 0) return ''
  return notes.slice(start + START.length, end).trim()
}

export function notesWithoutLinkedin(notes: string): string {
  const start = notes.indexOf(START)
  if (start < 0) return notes
  const end = notes.indexOf(END, start)
  if (end < 0) return notes
  const before = notes.slice(0, start).trimEnd()
  const after = notes.slice(end + END.length).trimStart()
  return [before, after].filter(Boolean).join('\n\n')
}

export function firstHttpUrl(raw: string): string {
  const match = raw.trim().match(/https?:\/\/[^\s]+/i)
  if (!match) return raw.trim()
  return match[0].replace(/[.,;]+$/g, '')
}

export function upsertLinkedinInNotes(notes: string, url: string): string {
  const base = notesWithoutLinkedin(notes).trim()
  const trimmed = firstHttpUrl(url)
  if (!trimmed) return base
  const block = `${START}\n${trimmed}\n${END}`
  if (!base) return block
  return `${base}\n\n${block}`
}
