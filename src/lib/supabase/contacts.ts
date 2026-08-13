import { supabase } from './client'
import type { CsvContactRow } from '../csv'
import type { Database } from './types'
import type { Agent, BrandId, Contact, IndustryCategory, PipelineStage, TpsStatus } from '../../data/mock'
import { parseLinkedinUrl, upsertLinkedinInNotes } from '../linkedin'

type ContactUpdate = Database['public']['Tables']['contacts']['Update']
type ContactInsert = Database['public']['Tables']['contacts']['Insert']

const CONTACT_COLUMNS =
  'id, name, company, phone, email, avatar_url, owner_id, stage, source, timezone, quiet_hours, do_not_call, notes, tags, next_callback, region, brand_id, industry, locality, tps_status, tps_screened_at'

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
  tps_status: TpsStatus
  tps_screened_at: string | null
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
    tpsStatus: row.tps_status,
    tpsScreenedAt: row.tps_screened_at ?? undefined,
    linkedinUrl: parseLinkedinUrl(row.notes),
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

/**
 * Screens the given contacts against TPS/CTPS via the screen-tps-ctps edge
 * function and writes tps_status back onto each row. Returns whether the
 * screening provider is actually configured yet (PROVERO_API_KEY) — false
 * means nothing was screened and callers should say so, not pretend it worked.
 */
export async function screenContactsForTps(
  contactIds: string[],
): Promise<{ configured: boolean; screened: number; failed: number; message?: string }> {
  if (contactIds.length === 0) return { configured: true, screened: 0, failed: 0 }
  const { data, error } = await supabase.functions.invoke('screen-tps-ctps', {
    body: { contactIds },
  })
  if (error) throw error
  return data as { configured: boolean; screened: number; failed: number; message?: string }
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

export type CreateContactInput = {
  name: string
  company: string
  email: string
  phone: string
  notes: string
  tags: string[]
  brandId: BrandId
  ownerId: string
  linkedinUrl?: string
  locality?: string
}

export type CreateContactResult =
  | { ok: true; contact: Contact }
  | { ok: false; duplicateId: string }

/**
 * Add one person by hand. Email match is per-brand (same as CSV). Phone
 * numbers always start unscreened — never look "clear to call" just because
 * you typed them in.
 */
export async function createContact(
  input: CreateContactInput,
  agents: Agent[],
): Promise<CreateContactResult> {
  const name = input.name.trim()
  if (!name) throw new Error('Name is required.')

  const email = input.email.trim().toLowerCase()
  const phone = input.phone.trim()
  const linkedinUrl = input.linkedinUrl?.trim() ?? ''
  const notes = upsertLinkedinInNotes(input.notes, linkedinUrl)

  if (email) {
    const { data: existing, error: lookupError } = await supabase
      .from('contacts')
      .select('id')
      .eq('brand_id', input.brandId)
      .ilike('email', email)
      .limit(1)
    if (lookupError) throw lookupError
    if (existing && existing.length > 0) {
      return { ok: false, duplicateId: (existing[0] as { id: string }).id }
    }
  }

  const row: ContactInsert = {
    name,
    email,
    company: input.company.trim(),
    phone,
    owner_id: input.ownerId,
    stage: 'new',
    source: linkedinUrl ? 'linkedin' : 'manual',
    timezone: 'Europe/London',
    quiet_hours: '',
    do_not_call: false,
    notes,
    tags: input.tags,
    region: 'other',
    brand_id: input.brandId,
    locality: input.locality?.trim() ?? '',
    tps_status: 'unscreened',
  }

  const { data, error } = await supabase.from('contacts').insert(row).select(CONTACT_COLUMNS).single()
  if (error) throw error
  const agentsById = new Map(agents.map((a) => [a.id, a]))
  return { ok: true, contact: toContact(data as ContactRow, agentsById) }
}

export async function updateContactDetails(
  id: string,
  patch: {
    name?: string
    company?: string
    phone?: string
    email?: string
    tags?: string[]
    notes?: string
    linkedinUrl?: string
    currentNotes?: string
  },
) {
  const db: ContactUpdate = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) db.name = patch.name.trim()
  if (patch.company !== undefined) db.company = patch.company.trim()
  if (patch.email !== undefined) db.email = patch.email.trim().toLowerCase()
  if (patch.tags !== undefined) db.tags = patch.tags
  if (patch.phone !== undefined) {
    db.phone = patch.phone.trim()
    // New/changed number is not the old screening result.
    db.tps_status = 'unscreened'
    db.tps_screened_at = null
  }
  if (patch.linkedinUrl !== undefined) {
    db.notes = upsertLinkedinInNotes(patch.currentNotes ?? '', patch.linkedinUrl)
  } else if (patch.notes !== undefined) {
    db.notes = patch.notes
  }
  const { error } = await supabase.from('contacts').update(db).eq('id', id)
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
): Promise<{ inserted: number; updated: number; contactIds: string[] }> {
  if (rows.length === 0) return { inserted: 0, updated: 0, contactIds: [] }

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
  const contactIds: string[] = []
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
      if (row.phone && !existing.phone) patch.phone = row.phone
      if (row.nextCallback) patch.next_callback = row.nextCallback
      if (!existing.source) patch.source = 'email-campaign'

      const { error } = await supabase.from('contacts').update(patch).eq('id', existing.id)
      if (error) throw error
      updated++
      contactIds.push(existing.id)
    } else {
      toInsert.push({
        name: row.name,
        email: key,
        company: row.company,
        phone: row.phone,
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
    const { data, error } = await supabase.from('contacts').insert(slice).select('id')
    if (error) throw error
    for (const row of data ?? []) contactIds.push((row as { id: string }).id)
  }

  return { inserted, updated, contactIds }
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
