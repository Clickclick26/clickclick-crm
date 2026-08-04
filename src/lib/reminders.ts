/** In-app + browser follow-up reminders (no email server needed). */

const STORAGE_KEY = 'cc-crm-followup-reminded-on'
const PERMISSION_ASKED_KEY = 'cc-crm-notify-asked'

export function dueFollowUpCount(
  contacts: { nextCallback?: string }[],
  isDue: (next?: string) => boolean,
): number {
  return contacts.filter((c) => isDue(c.nextCallback)).length
}

export async function ensureNotifyPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission
  }
  return Notification.requestPermission()
}

export function hasAskedNotifyPermission(): boolean {
  try {
    return localStorage.getItem(PERMISSION_ASKED_KEY) === '1'
  } catch {
    return false
  }
}

export function markAskedNotifyPermission() {
  try {
    localStorage.setItem(PERMISSION_ASKED_KEY, '1')
  } catch {
    /* ignore */
  }
}

/** Fire at most once per calendar day while the CRM is open. */
export function remindFollowUpsIfNeeded(opts: {
  dueCount: number
  onToast: (msg: string) => void
  openDueList: () => void
}): void {
  if (opts.dueCount <= 0) return

  const today = new Date().toISOString().slice(0, 10)
  try {
    if (localStorage.getItem(STORAGE_KEY) === today) return
    localStorage.setItem(STORAGE_KEY, today)
  } catch {
    /* still toast once this session */
  }

  const label =
    opts.dueCount === 1
      ? '1 follow-up is due today'
      : `${opts.dueCount} follow-ups are due today`

  opts.onToast(`${label} — open Due to see them.`)

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification('ClickClick CRM', {
        body: label,
        tag: `cc-crm-due-${today}`,
      })
      n.onclick = () => {
        window.focus()
        opts.openDueList()
        n.close()
      }
    } catch {
      /* ignore */
    }
  }
}
