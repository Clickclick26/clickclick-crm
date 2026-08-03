import { supabase } from './client'
import type { Agent } from '../../data/mock'

export async function fetchAgents(): Promise<Agent[]> {
  const { data, error } = await supabase
    .from('agents')
    .select('id, name, role, online, on_call_with, personal_number_id')
    .order('name')

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    online: row.online,
    onCallWith: row.on_call_with ?? undefined,
    personalNumberId: row.personal_number_id ?? '',
  }))
}
