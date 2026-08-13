import type { BrandId } from '../data/mock'

export type ListOption = { id: string; label: string }

export type CustomList = { brandId: BrandId; id: string; label: string }

export const BUILTIN_LISTS: Record<BrandId, ListOption[]> = {
  clickclick: [
    { id: 'replied', label: 'Replied' },
    { id: 'warmed', label: 'Warmed' },
  ],
  clocal: [
    { id: 'waitlist', label: 'Waitlist' },
    { id: 'newsletter', label: 'Newsletter' },
    { id: 'cold-outreach', label: 'Cold outreach' },
  ],
}

const STORAGE_KEY = 'cc-crm-custom-lists'

const RESERVED = new Set([
  'all',
  'due',
  'replied',
  'warmed',
  'waitlist',
  'newsletter',
  'cold-outreach',
  'clocal',
  'clickclick',
])

export function slugifyListName(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

export function listsForBrand(brandId: BrandId, custom: CustomList[]): ListOption[] {
  const seen = new Set(BUILTIN_LISTS[brandId].map((l) => l.id))
  const extra: ListOption[] = []
  for (const item of custom) {
    if (item.brandId !== brandId) continue
    if (seen.has(item.id)) continue
    seen.add(item.id)
    extra.push({ id: item.id, label: item.label })
  }
  return [...BUILTIN_LISTS[brandId], ...extra]
}

export function loadCustomLists(): CustomList[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CustomList[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item) =>
        item &&
        (item.brandId === 'clickclick' || item.brandId === 'clocal') &&
        typeof item.id === 'string' &&
        typeof item.label === 'string',
    )
  } catch {
    return []
  }
}

export function saveCustomLists(lists: CustomList[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists))
  } catch {
    // Private mode / quota — views still work for this session.
  }
}

export function addCustomList(
  existing: CustomList[],
  brandId: BrandId,
  label: string,
): { lists: CustomList[]; id: string; error?: string } {
  const trimmed = label.trim()
  if (!trimmed) return { lists: existing, id: '', error: 'Type a list name.' }
  const id = slugifyListName(trimmed)
  if (!id) return { lists: existing, id: '', error: 'Use letters or numbers in the name.' }
  if (RESERVED.has(id)) return { lists: existing, id, error: 'That list already exists.' }
  if (existing.some((item) => item.brandId === brandId && item.id === id)) {
    return { lists: existing, id }
  }
  const lists = [...existing, { brandId, id, label: trimmed }]
  saveCustomLists(lists)
  return { lists, id }
}
