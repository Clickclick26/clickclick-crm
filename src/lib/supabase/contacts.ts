import { supabase } from './client'
import type { CsvContactRow } from '../csv'
import type { Database } from './types'
import type { Agent, BrandId, Contact, IndustryCategory, PipelineStage } from '../../data/mock'

type ContactUpdate = Database['public']['Tables']['contacts']['Update']
type ContactInsert = Database['public']['Tables']['contacts']['Insert']

const CONTACT_COLUMNS =
  'id, name, company, phone, email, avatar_url, owner_id, stage, source, timezone, quiet_hours, do_not_call, notes, tags, next_callback, region, brand_id, industry, locality'

type ContactRow = {
  id: string
  name: string
  company: string
  phone: string
  email: string
  avatar_url: string | null
  owner_id: string | null
  stage: PipelineStage
  source: string
  timezone: string
  quiet_hours: string
  do_not_call: boolean
  notes: string
  tags: string[]
  next_callback: string | null
  region: Contact['region']
  brand_id: BrandId
  industry: IndustryCategory | null
  locality: string
}

function toContact(row: ContactRow, agentsById: Map<string, Agent>): Contact {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    phone: row.phone,
    email: row.email,
    avatar: row.avatar_url ?? '',
    owner: row.owner_id ? (agentsById.get(row.owner_id)?.name ?? 'Unassigned') : 'Unassigned',
    stage: row.stage,
    source: row.source,
    timezone: row.timezone,
    quietHours: row.quiet_hours,
    doNotCall: row.do_not_call,
    notes: row.notes,
    tags: row.tags,
    nextCallback: row.next_callback ?? undefined,
    region: row.region,
    brandId: row.brand_id,
    industry: row.industry,
    locality: row.locality,
  }
}

export async function fetchContacts(agents: Agent[]): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select(CONTACT_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw error

  const agentsById = new Map(agents.map((a) => [a.id, a]))
  return (data ?? []).map((row) => toContact(row as ContactRow, agentsById))
}

export async function updateContactCategory(
  id: string,
  patch: { industry?: IndustryCategory | null; locality?: string },
) {
  const { error } = await supabase
    .from('contacts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function updateContactNotes(id: string, notes: string) {
  const { error } = await supabase.from('contacts').update({ notes }).eq('id', id)
  if (error) throw error
}

export async function updateContactStage(id: string, stage: PipelineStage) {
  const { error } = await supabase.from('contacts').update({ stage }).eq('id', id)
  if (error) throw error
}

export async function updateContactFollowUp(id: string, nextCallback: string | null) {
  const { error } = await supabase
    .from('contacts')
    .update({ next_callback: nextCallback, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

function mergeTags(existing: string[] | null | undefined, tag: string | null): string[] {
  const base = [...(existing ?? [])]
  if (!tag) return base
  if (!base.includes(tag)) base.push(tag)
  // Keep replied/warmed mutually exclusive for list filters.
  if (tag === 'replied') return base.filter((t) => t !== 'warmed')
  if (tag === 'warmed') return base.filter((t) => t !== 'replied')
  return base
}

function mergeNotes(existing: string, incoming: string): string {
  const a = existing.trim()
  const b = incoming.trim()
  if (!b) return a
  if (!a) return b
  if (a.includes(b)) return a
  return `${a}\n\n${b}`
}

/**
 * Import / update contacts from CSV rows, scoped to one brand. Match on
 * email (case-insensitive) *within that brand only* — the same person can
 * legitimately be a ClickClick contact and a CLocal contact under one
 * email, and matching across brands would merge them into a single row
 * (same mixing bug fixed in waitlist-ingest; same fix here). Stage stays
 * new unless already further along.
 */
export async function importCsvContacts(
  rows: CsvContactRow[],
  ownerId: string,
  brandId: BrandId,
): Promise<{ inserted: number; updated: number }> {
  if (rows.length === 0) return { inserted: 0, updated: 0 }

  // Last row wins if the same email appears twice in one file.
  const byEmail = new Map<string, CsvContactRow>()
  for (const row of rows) byEmail.set(row.email.toLowerCase(), row)
  const uniqueRows = [...byEmail.values()]

  const emails = uniqueRows.map((r) => r.email.toLowerCase())
  const existingByEmail = new Map<string, ContactRow>()

  // Supabase .in() is fine in chunks for large lists.
  const chunk = 200
  for (let i = 0; i < emails.length; i += chunk) {
    const slice = emails.slice(i, i + chunk)
    const { data, error } = await supabase
      .from('contacts')
      .select(CONTACT_COLUMNS)
      .in('email', slice)
      .eq('brand_id', brandId)
    if (error) throw error
    for (const row of data ?? []) {
      const typed = row as ContactRow
      existingByEmail.set(typed.email.toLowerCase(), typed)
    }
  }

  let inserted = 0
  let updated = 0
  const toInsert: ContactInsert[] = []

  for (const row of uniqueRows) {
    const key = row.email.toLowerCase()
    const existing = existingByEmail.get(key)
    if (existing) {
      const tags = mergeTags(existing.tags, row.tag)
      const notes = mergeNotes(existing.notes, row.notes)
      const patch: ContactUpdate = {
        tags,
        notes,
        updated_at: new Date().toISOString(),
      }
      if (row.company && !existing.company) patch.company = row.company
      if (row.name && existing.name !== row.name) patch.name = row.name
      if (row.nextCallback) patch.next_callback = row.nextCallback
      if (!existing.source) patch.source = 'email-campaign'

      const { error } = await supabase.from('contacts').update(patch).eq('id', existing.id)
      if (error) throw error
      updated++
    } else {
      toInsert.push({
        name: row.name,
        email: key,
        company: row.company,
        phone: '',
        owner_id: ownerId,
        stage: 'new',
        source: 'email-campaign',
        timezone: 'Europe/London',
        quiet_hours: '',
        do_not_call: false,
        notes: row.notes,
        tags: row.tag ? [row.tag] : [],
        next_callback: row.nextCallback || null,
        region: 'other',
        brand_id: brandId,
      })
      inserted++
    }
  }

  for (let i = 0; i < toInsert.length; i += chunk) {
    const slice = toInsert.slice(i, i + chunk)
    const { error } = await supabase.from('contacts').insert(slice)
    if (error) throw error
  }

  return { inserted, updated }
}

/** True when follow-up date is today or overdue (YYYY-MM-DD). Free-text dates are ignored. */
export function isFollowUpDue(nextCallback: string | undefined, todayIso = todayYmd()): boolean {
  if (!nextCallback) return false
  const m = nextCallback.trim().match(/^(\d{4}-\d{2}-\d{2})/)
  if (!m) return false
  return m[1] <= todayIso
}

export function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}
