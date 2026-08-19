import { supabase } from './client'
import { ensureFreshSession } from './session'
import type { CsvContactRow } from '../csv'
import type { Database } from './types'
import type { Agent, BrandId, Contact, IndustryCategory, PipelineStage, TpsStatus } from '../../data/mock'
import { parseLinkedinUrl, upsertLinkedinInNotes, firstHttpUrl } from '../linkedin'
import { parsePeople, upsertPeopleInNotes, type ExtraPerson, type PersonRole } from '../people'

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
  const people = parsePeople(row.notes)
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
    personRole: people.role,
    extraPeople: people.extra,
  }
}

export async function fetchContacts(agents: Agent[]): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select(CONTACT_COLUMNS)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  if (error) throw error

  const agentsById = new Map(agents.map((a) => [a.id, a]))
  return (data ?? []).map((row) => toContact(row as ContactRow, agentsById))
}

/** "Delete" archives rather than hard-deletes — calls/deals have no ON DELETE
 * rule, so a real delete on a contact with any history would throw a
 * foreign-key error mid-scroll. Archived contacts just stop showing up in
 * fetchContacts. Reversible via unarchiveContact (used for the Undo toast). */
export async function archiveContact(id: string): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function unarchiveContact(id: string): Promise<void> {
  const { error } = await supabase.from('contacts').update({ archived_at: null }).eq('id', id)
  if (error) throw error
}

/**
 * Merges `loseId` into `keepId`: every call/deal/referral/list membership
 * pointing at the duplicate now points at the kept contact, tags and notes
 * are combined onto the kept contact, and the duplicate is archived (not
 * hard-deleted, for the same FK reasons as archiveContact).
 */
export async function mergeContacts(keepId: string, loseId: string): Promise<void> {
  if (keepId === loseId) throw new Error('Pick two different people to merge.')
  await ensureFreshSession()

  const { data: rows, error: fetchErr } = await supabase
    .from('contacts')
    .select(CONTACT_COLUMNS)
    .in('id', [keepId, loseId])
  if (fetchErr) throw fetchErr
  const keep = (rows ?? []).find((r) => (r as ContactRow).id === keepId) as ContactRow | undefined
  const lose = (rows ?? []).find((r) => (r as ContactRow).id === loseId) as ContactRow | undefined
  if (!keep || !lose) throw new Error('Could not find both contacts to merge.')

  // Reassign dependent rows first — dialer_list_members has a (list_id, contact_id)
  // primary key, so a straight reassign can collide if the kept contact is
  // already on the same list; fall back to dropping the duplicate's row.
  const { error: callsErr } = await supabase
    .from('calls')
    .update({ contact_id: keepId })
    .eq('contact_id', loseId)
  if (callsErr) throw callsErr

  const { error: dealsErr } = await supabase
    .from('deals')
    .update({ contact_id: keepId })
    .eq('contact_id', loseId)
  if (dealsErr) throw dealsErr

  const { error: referrerErr } = await supabase
    .from('referrals')
    .update({ referrer_contact_id: keepId })
    .eq('referrer_contact_id', loseId)
  if (referrerErr) throw referrerErr

  const { error: referredErr } = await supabase
    .from('referrals')
    .update({ referred_contact_id: keepId })
    .eq('referred_contact_id', loseId)
  if (referredErr) throw referredErr

  const { data: loserLists } = await supabase
    .from('dialer_list_members')
    .select('list_id')
    .eq('contact_id', loseId)
  for (const { list_id } of (loserLists ?? []) as { list_id: string }[]) {
    const { error: memberErr } = await supabase
      .from('dialer_list_members')
      .update({ contact_id: keepId })
      .eq('contact_id', loseId)
      .eq('list_id', list_id)
    // 23505 = kept contact is already on that list — drop the duplicate's row instead.
    if (memberErr && memberErr.code === '23505') {
      await supabase
        .from('dialer_list_members')
        .delete()
        .eq('contact_id', loseId)
        .eq('list_id', list_id)
    } else if (memberErr) {
      throw memberErr
    }
  }

  const mergedTags = Array.from(new Set([...(keep.tags ?? []), ...(lose.tags ?? [])]))
  const keepNotes = keep.notes?.trim() ?? ''
  const loseNotes = lose.notes?.trim() ?? ''
  const mergedNotes =
    !loseNotes || keepNotes.includes(loseNotes)
      ? keepNotes
      : keepNotes
        ? `${keepNotes}\n\n${loseNotes}`
        : loseNotes

  const patch: ContactUpdate = {
    tags: mergedTags,
    notes: mergedNotes,
    company: keep.company || lose.company,
    phone: keep.phone || lose.phone,
    email: keep.email || lose.email,
    locality: keep.locality || lose.locality,
    updated_at: new Date().toISOString(),
  }
  const { error: patchErr } = await supabase.from('contacts').update(patch).eq('id', keepId)
  if (patchErr) throw patchErr

  const { error: archiveErr } = await supabase
    .from('contacts')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', loseId)
  if (archiveErr) throw archiveErr
}

export async function updateContactCategory(
  id: string,
  patch: { industry?: IndustryCategory | null; locality?: string; region?: Contact['region'] },
) {
  const { error } = await supabase
    .from('contacts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export type TpsScreenResult = {
  configured: boolean
  screened: number
  failed: number
  /** Had no phone number at all — nothing to screen, not a failure. */
  skipped: number
  /** Up to 25 real failures with a name + reason, so "N failed" is never a dead end. */
  issues: { name: string; reason: string }[]
  message?: string
}

/**
 * Screens the given contacts against TPS/CTPS via the screen-tps-ctps edge
 * function and writes tps_status back onto each row. Returns whether the
 * screening provider is actually configured yet (PROVERO_API_KEY) — false
 * means nothing was screened and callers should say so, not pretend it worked.
 */
export async function screenContactsForTps(contactIds: string[]): Promise<TpsScreenResult> {
  if (contactIds.length === 0) {
    return { configured: true, screened: 0, failed: 0, skipped: 0, issues: [] }
  }
  const { data, error } = await supabase.functions.invoke('screen-tps-ctps', {
    body: { contactIds },
  })
  if (error) throw error
  const result = data as Partial<TpsScreenResult>
  return {
    configured: result.configured ?? false,
    screened: result.screened ?? 0,
    failed: result.failed ?? 0,
    skipped: result.skipped ?? 0,
    issues: result.issues ?? [],
    message: result.message,
  }
}

export async function updateContactNotes(id: string, notes: string) {
  if (!id) return
  await ensureFreshSession()
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
  region?: Contact['region']
  industry?: IndustryCategory | null
  nextCallback?: string
  personRole?: PersonRole
  extraPeople?: ExtraPerson[]
}

export type CreateContactResult =
  | { ok: true; contact: Contact }
  | { ok: false; duplicateId: string }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * Add one person by hand. Email match is per-brand (same as CSV). Phone
 * numbers always start unscreened — never look "clear to call" just because
 * you typed them in.
 */
export async function createContact(
  input: CreateContactInput,
  agents: Agent[],
): Promise<CreateContactResult> {
  await ensureFreshSession()

  const name = input.name.trim()
  if (!name) throw new Error('Name is required.')

  const email = input.email.trim().toLowerCase()
  const phone = input.phone.trim()
  const linkedinUrl = firstHttpUrl(input.linkedinUrl ?? '')
  const notes = upsertLinkedinInNotes(
    upsertPeopleInNotes(input.notes, input.personRole ?? 'main', input.extraPeople ?? []),
    linkedinUrl,
  )

  if (email) {
    const { data: existing, error: lookupError } = await supabase
      .from('contacts')
      .select('id')
      .eq('brand_id', input.brandId)
      .ilike('email', escapeIlike(email))
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
    phone: phone || '',
    owner_id: UUID_RE.test(input.ownerId) ? input.ownerId : null,
    stage: 'new',
    source: linkedinUrl ? 'linkedin' : 'manual',
    timezone: 'Europe/London',
    quiet_hours: '',
    do_not_call: false,
    notes,
    tags: input.tags,
    region: input.region ?? 'other',
    brand_id: input.brandId,
    locality: input.locality?.trim() ?? '',
    industry: input.industry ?? null,
    next_callback: input.nextCallback?.trim() || null,
    tps_status: 'unscreened',
  }

  let { data, error } = await supabase.from('contacts').insert(row).select(CONTACT_COLUMNS)
  if (error && error.code === '23503' && /owner_id/.test(error.message)) {
    const retry = { ...row, owner_id: null }
    ;({ data, error } = await supabase.from('contacts').insert(retry).select(CONTACT_COLUMNS))
  }
  if (error && error.code === '23514') {
    const retry = { ...row, source: '' }
    ;({ data, error } = await supabase.from('contacts').insert(retry).select(CONTACT_COLUMNS))
  }
  if (error) throw error

  let created = (data?.[0] ?? null) as ContactRow | null
  if (!created) {
    const foundQuery = supabase
      .from('contacts')
      .select(CONTACT_COLUMNS)
      .eq('brand_id', input.brandId)
      .eq('name', name)
      .limit(1)
    const { data: found } = email
      ? await foundQuery.eq('email', email)
      : await foundQuery
    created = (found?.[0] ?? null) as ContactRow | null
  }
  if (!created) {
    throw new Error('Saved, but I could not load them. Refresh the page.')
  }

  const agentsById = new Map(agents.map((a) => [a.id, a]))
  return { ok: true, contact: toContact(created, agentsById) }
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
    personRole?: PersonRole
    extraPeople?: ExtraPerson[]
  },
) {
  if (!id) return
  await ensureFreshSession()
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
  const touchesNotes =
    patch.notes !== undefined ||
    patch.linkedinUrl !== undefined ||
    patch.personRole !== undefined ||
    patch.extraPeople !== undefined
  if (touchesNotes) {
    let next = patch.currentNotes ?? patch.notes ?? ''
    if (patch.notes !== undefined) next = patch.notes
    const parsed = parsePeople(next)
    next = upsertPeopleInNotes(
      next,
      patch.personRole ?? parsed.role,
      patch.extraPeople ?? parsed.extra,
    )
    next = upsertLinkedinInNotes(
      next,
      patch.linkedinUrl !== undefined ? patch.linkedinUrl : parseLinkedinUrl(next),
    )
    db.notes = next
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
