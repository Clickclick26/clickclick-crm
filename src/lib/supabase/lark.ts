import { supabase } from './client'

type LarkInviteOpts = {
  contactName: string
  contactEmail: string
  agentName: string
  brand?: string
  /** If set, re-sends this link instead of reserving a new meeting. */
  existingJoinUrl?: string
}

export type LarkInviteResult = {
  joinUrl: string
  /** True only if the join link was actually emailed to the contact (needs Resend configured). */
  emailed: boolean
}

export async function createLarkVideoInvite(opts: LarkInviteOpts): Promise<LarkInviteResult> {
  const { data, error } = await supabase.functions.invoke('lark-video-invite', {
    body: opts,
  })
  if (error) throw error
  if (!data?.joinUrl) throw new Error('No meeting link returned')
  return { joinUrl: data.joinUrl as string, emailed: Boolean(data.emailed) }
}
