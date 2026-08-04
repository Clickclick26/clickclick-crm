/** Instagram outreach block stored inside contact notes (no DB migration). */

const START = '---INSTAGRAM---'
const MID = '---DM---'
const END = '---END---'

export type InstagramBlock = {
  url: string
  message: string
}

export function formatInstagramBlock(url: string, message: string): string {
  const u = url.trim()
  const m = message.trim()
  if (!u && !m) return ''
  return `${START}\n${u}\n${MID}\n${m}\n${END}`
}

export function parseInstagramBlock(notes: string): InstagramBlock | null {
  if (!notes) return null
  const start = notes.indexOf(START)
  if (start < 0) return null
  const mid = notes.indexOf(MID, start)
  const end = notes.indexOf(END, mid >= 0 ? mid : start)
  if (mid < 0 || end < 0) return null
  const url = notes.slice(start + START.length, mid).trim()
  const message = notes.slice(mid + MID.length, end).trim()
  if (!url && !message) return null
  return { url, message }
}

/** Notes without the IG block (for the normal notes box). */
export function notesWithoutInstagram(notes: string): string {
  const start = notes.indexOf(START)
  if (start < 0) return notes
  const end = notes.indexOf(END, start)
  if (end < 0) return notes
  const before = notes.slice(0, start).trimEnd()
  const after = notes.slice(end + END.length).trimStart()
  return [before, after].filter(Boolean).join('\n\n')
}

export function upsertInstagramInNotes(
  notes: string,
  url: string,
  message: string,
): string {
  const base = notesWithoutInstagram(notes).trim()
  const block = formatInstagramBlock(url, message)
  if (!block) return base
  if (!base) return block
  return `${base}\n\n${block}`
}
