import { supabase } from './client'
import { ensureFreshSession } from './session'

// Contact lists (the dialer_lists table). Some are filled by hand; "Bought a
// course" is filled automatically by the Academy's payment function every
// time someone buys, so it is the list to upsell from.

export type ContactList = { id: string; name: string; emoji: string; count: number }

export type ListMember = {
  id: string
  name: string
  email: string
  phone: string
  stage: string
  tags: string[]
  notes: string
}

export async function fetchLists(): Promise<ContactList[]> {
  await ensureFreshSession()
  const { data: lists, error } = await supabase
    .from('dialer_lists')
    .select('id, name, emoji, sort_order')
    .order('sort_order')
    .order('name')
  if (error) throw error

  const { data: members, error: memErr } = await supabase.from('dialer_list_members').select('list_id')
  if (memErr) throw memErr
  const counts = new Map<string, number>()
  for (const m of members ?? []) counts.set(m.list_id, (counts.get(m.list_id) ?? 0) + 1)

  return (lists ?? []).map((l) => ({ id: l.id, name: l.name, emoji: l.emoji, count: counts.get(l.id) ?? 0 }))
}

export async function fetchListMembers(listId: string): Promise<ListMember[]> {
  await ensureFreshSession()
  const { data: links, error } = await supabase
    .from('dialer_list_members')
    .select('contact_id')
    .eq('list_id', listId)
  if (error) throw error
  const ids = (links ?? []).map((l) => l.contact_id)
  if (ids.length === 0) return []

  const { data, error: cErr } = await supabase
    .from('contacts')
    .select('id, name, email, phone, stage, tags, notes')
    .in('id', ids)
    .is('archived_at', null)
    .order('name')
  if (cErr) throw cErr
  return (data ?? []) as ListMember[]
}
