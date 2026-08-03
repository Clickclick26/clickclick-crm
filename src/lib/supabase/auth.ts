import { useEffect, useState } from 'react'
import { supabase } from './client'
import type { Agent } from '../../data/mock'

async function fetchAgentRow(userId: string): Promise<Agent | null> {
  const { data, error } = await supabase
    .from('agents')
    .select('id, name, role, online, personal_number_id')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null

  return {
    id: data.id,
    name: data.name,
    role: data.role,
    online: data.online,
    personalNumberId: data.personal_number_id ?? '',
  }
}

/** Tracks the Supabase session and the signed-in user's `agents` row. */
export function useCurrentAgent() {
  const [loading, setLoading] = useState(true)
  const [agent, setAgent] = useState<Agent | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadFromSession(userId: string | undefined) {
      if (!userId) {
        if (!cancelled) {
          setAgent(null)
          setLoading(false)
        }
        return
      }
      // The agents row is created by a DB trigger right after sign-up; it can
      // take a moment to land, so retry briefly instead of showing "not found".
      for (let attempt = 0; attempt < 5; attempt++) {
        const row = await fetchAgentRow(userId)
        if (cancelled) return
        if (row) {
          setAgent(row)
          setLoading(false)
          return
        }
        await new Promise((r) => setTimeout(r, 400))
      }
      if (!cancelled) {
        setAgent(null)
        setLoading(false)
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      loadFromSession(data.session?.user.id)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(true)
      loadFromSession(session?.user.id)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  return { agent, loading }
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

/** Returns true if a session was created immediately (no email confirmation required). */
export async function signUpWithPassword(
  email: string,
  password: string,
  name: string,
): Promise<{ signedIn: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })
  if (error) throw error
  return { signedIn: data.session !== null }
}

export async function signOut() {
  await supabase.auth.signOut()
}
