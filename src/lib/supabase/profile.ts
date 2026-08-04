import { supabase } from './client'

const AVATAR_BUCKET = 'avatars'

// Stored under {agentId}/... so storage RLS can scope writes to the agent's own folder.
export async function uploadAvatar(agentId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${agentId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function updateAgentAvatar(agentId: string, avatarUrl: string): Promise<void> {
  const { error } = await supabase.from('agents').update({ avatar_url: avatarUrl }).eq('id', agentId)
  if (error) throw error
}
