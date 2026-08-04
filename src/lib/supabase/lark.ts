import { supabase } from './client'

type LarkInviteOpts = {
  contactName: string
  contactEmail: string
  agentName: string
  brand?: string
  /** If set, re-sends this link instead of reserving a new meeting. */
  existingJoinUrl?: string
}

export async function createLarkVideoInvite(opts: LarkInviteOpts): Promise<string> {
  const { data, error } = await supabase.functions.invoke('lark-video-invite', {
    body: opts,
  })
  if (error) throw error
  if (!data?.joinUrl) throw new Error('No meeting link returned')
  return data.joinUrl as string
}
