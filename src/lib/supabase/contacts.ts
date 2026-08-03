import { supabase } from './client'
import type { Agent, Contact, PipelineStage } from '../../data/mock'

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
  }
}

export async function fetchContacts(agents: Agent[]): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select(
      'id, name, company, phone, email, avatar_url, owner_id, stage, source, timezone, quiet_hours, do_not_call, notes, tags, next_callback, region',
    )
    .order('created_at', { ascending: false })

  if (error) throw error

  const agentsById = new Map(agents.map((a) => [a.id, a]))
  return (data ?? []).map((row) => toContact(row as ContactRow, agentsById))
}

export async function updateContactNotes(id: string, notes: string) {
  const { error } = await supabase.from('contacts').update({ notes }).eq('id', id)
  if (error) throw error
}

export async function updateContactStage(id: string, stage: PipelineStage) {
  const { error } = await supabase.from('contacts').update({ stage }).eq('id', id)
  if (error) throw error
}
