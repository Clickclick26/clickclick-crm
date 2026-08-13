export const PERSON_ROLES = [
  { id: 'main', label: 'Main contact' },
  { id: 'founder', label: 'Founder' },
  { id: 'co-founder', label: 'Co-founder' },
  { id: 'decision-maker', label: 'Decision maker' },
  { id: 'other', label: 'Other' },
] as const

export type PersonRole = (typeof PERSON_ROLES)[number]['id']

export type ExtraPerson = {
  name: string
  role: PersonRole
}

const START = '---PEOPLE---'
const END = '---END-PEOPLE---'

type PeopleBlock = {
  role: PersonRole
  extra: ExtraPerson[]
}

function isRole(value: string): value is PersonRole {
  return PERSON_ROLES.some((role) => role.id === value)
}

export function roleLabel(id: PersonRole): string {
  return PERSON_ROLES.find((role) => role.id === id)?.label ?? id
}

export function parsePeople(notes: string): PeopleBlock {
  const empty: PeopleBlock = { role: 'main', extra: [] }
  if (!notes) return empty
  const start = notes.indexOf(START)
  if (start < 0) return empty
  const end = notes.indexOf(END, start)
  if (end < 0) return empty
  const raw = notes.slice(start + START.length, end).trim()
  try {
    const parsed = JSON.parse(raw) as { role?: string; extra?: ExtraPerson[] }
    return {
      role: parsed.role && isRole(parsed.role) ? parsed.role : 'main',
      extra: Array.isArray(parsed.extra)
        ? parsed.extra
            .filter((p) => p && typeof p.name === 'string' && p.name.trim())
            .map((p) => ({
              name: p.name.trim(),
              role: p.role && isRole(p.role) ? p.role : 'other',
            }))
        : [],
    }
  } catch {
    return empty
  }
}

export function notesWithoutPeople(notes: string): string {
  const start = notes.indexOf(START)
  if (start < 0) return notes
  const end = notes.indexOf(END, start)
  if (end < 0) return notes
  const before = notes.slice(0, start).trimEnd()
  const after = notes.slice(end + END.length).trimStart()
  return [before, after].filter(Boolean).join('\n\n')
}

export function upsertPeopleInNotes(
  notes: string,
  role: PersonRole,
  extra: ExtraPerson[],
): string {
  const base = notesWithoutPeople(notes).trim()
  const clean = extra
    .map((p) => ({ name: p.name.trim(), role: isRole(p.role) ? p.role : 'other' }))
    .filter((p) => p.name)
  if (role === 'main' && clean.length === 0) return base
  const block = `${START}\n${JSON.stringify({ role, extra: clean })}\n${END}`
  if (!base) return block
  return `${base}\n\n${block}`
}
