/** Keep you on the same CRM screen if auth refreshes or the tab remounts. */

const PLACE_KEY = 'cc-crm-place'
const DRAFT_KEY = 'cc-crm-new-contact-draft'

export type SavedPlace = {
  nav: string
  composingNew: boolean
  contactsBrand: string
  contactFilter: string
  categoryFilter: string
  selectedContactId: string
}

function readJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function loadPlace(): SavedPlace | null {
  return readJson<SavedPlace>(PLACE_KEY)
}

export function savePlace(place: SavedPlace) {
  try {
    sessionStorage.setItem(PLACE_KEY, JSON.stringify(place))
  } catch {
    /* private mode */
  }
}

export function loadNewContactDraft<T>(): T | null {
  return readJson<T>(DRAFT_KEY)
}

export function saveNewContactDraft(draft: unknown) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* private mode */
  }
}

export function clearNewContactDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    /* private mode */
  }
}
