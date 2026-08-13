import { supabase } from './client'

/** Refresh the login token if it’s missing or about to die. */
export async function ensureFreshSession() {
  const { data } = await supabase.auth.getSession()
  const expiresAt = data.session?.expires_at
  const stale =
    !data.session || (expiresAt != null && expiresAt * 1000 < Date.now() + 60_000)
  if (!stale) return data.session

  const { data: refreshed } = await supabase.auth.refreshSession()
  if (refreshed.session) return refreshed.session
  throw new Error('SIGNED_OUT')
}

function errBits(err: unknown): { message: string; code: string; status: number } {
  const e = err as { message?: string; code?: string | number; status?: number }
  return {
    message: typeof e?.message === 'string' ? e.message : '',
    code: e?.code != null ? String(e.code) : '',
    status: typeof e?.status === 'number' ? e.status : 0,
  }
}

/** Short, plain reason for a failed contact save. */
export function saveFailMessage(err: unknown): string {
  if (err instanceof Error && err.message === 'SIGNED_OUT') {
    return "You're signed out. Sign in again, then save."
  }
  const { message, code, status } = errBits(err)
  const lower = message.toLowerCase()
  if (
    status === 401 ||
    code === '401' ||
    lower.includes('jwt') ||
    lower.includes('not authenticated') ||
    lower.includes('row-level security') ||
    lower.includes('invalid claim')
  ) {
    return "You're signed out. Sign in again, then save."
  }
  if (code === '23503') return 'Could not save — pick ClickClick or CLocal and try again.'
  if (code === '23502') return 'Could not save — a required box is empty.'
  if (code === '23514') return 'Could not save — one field is not allowed.'
  if (code === '23505') return 'That person is already in the list.'
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Could not save — check your internet and try again.'
  }
  if (message) return `Could not save. ${message}`
  return 'Could not save. Try again.'
}
