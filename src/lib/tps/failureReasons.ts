/**
 * Why a TPS/CTPS check failed, kept per contact so the reason outlives the
 * toast that announced it.
 *
 * The screening result reaches the UI exactly once. Without somewhere to put
 * the reason, a 'check_failed' badge can only say "screening failed", which
 * covers two situations needing opposite fixes: the number was junk (fix the
 * contact) or the screening provider rejected us (top up / renew the Provero
 * account). Calling is already blocked either way — see the tpsStatus gate in
 * App.tsx — so this is about knowing what to do next, not about call safety.
 *
 * Deliberately browser-local rather than a database column: it's a note for
 * whoever is looking at the contact now, and it goes stale the moment the
 * contact is re-screened. Every read is defensive because localStorage throws
 * outright in some privacy modes rather than returning null.
 */
const STORAGE_KEY = 'clickclick-crm.tps-failure-reasons'

export type TpsFailureReasons = Record<string, string>

export function loadTpsFailureReasons(): TpsFailureReasons {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    // Drop anything that isn't a plain id→string pair, so a corrupted or
    // hand-edited entry can't render as "[object Object]" on the contact.
    const clean: TpsFailureReasons = {}
    for (const [id, reason] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof reason === 'string' && reason) clean[id] = reason
    }
    return clean
  } catch {
    return {}
  }
}

export function saveTpsFailureReasons(reasons: TpsFailureReasons): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reasons))
  } catch {
    // Storage unavailable (private mode, blocked site data). The reason still
    // shows for this session via React state; it just won't survive a reload.
  }
}

/**
 * Merges a screening pass into the stored reasons: `failures` replaces any
 * previous reason for those contacts, and every id in `screenedIds` that
 * didn't fail has its old reason dropped, so a contact that now screens
 * clear stops showing why it failed last week.
 */
export function mergeTpsFailureReasons(
  current: TpsFailureReasons,
  screenedIds: string[],
  failures: TpsFailureReasons,
): TpsFailureReasons {
  const next: TpsFailureReasons = { ...current }
  for (const id of screenedIds) delete next[id]
  for (const [id, reason] of Object.entries(failures)) next[id] = reason
  return next
}
