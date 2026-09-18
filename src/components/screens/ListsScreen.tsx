import { useEffect, useRef, useState } from 'react'
import { fetchListMembers, fetchLists, type ContactList, type ListMember } from '../../lib/supabase/lists'

/**
 * Contact lists, read from the database. Same markup and classNames as the
 * original mock version; the only additions are the member table under the
 * list (so "Bought a course" can be worked from here) and a copy-emails
 * button for upsell emails.
 */
export function ListsScreen({
  activeList,
  onSelectList,
  onToast,
}: {
  activeList: string
  onSelectList: (id: string) => void
  onToast: (msg: string) => void
}) {
  const [lists, setLists] = useState<ContactList[] | null>(null)
  const [members, setMembers] = useState<ListMember[] | null>(null)
  // App passes a fresh onToast every render. Reading it through a ref keeps
  // it out of the effects below, or every toast would re-render App, refetch
  // the list, and a failing fetch would toast again: a loop.
  const toast = useRef(onToast)
  toast.current = onToast

  useEffect(() => {
    let live = true
    fetchLists()
      .then((l) => {
        if (!live) return
        setLists(l)
        // The app starts on a mock list id; land on the first real list.
        if (l.length && !l.some((x) => x.id === activeList)) onSelectList(l[0].id)
      })
      .catch(() => live && toast.current('Could not load lists.'))
    return () => {
      live = false
    }
    // Load once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!lists?.some((l) => l.id === activeList)) return
    let live = true
    setMembers(null)
    fetchListMembers(activeList)
      .then((m) => live && setMembers(m))
      .catch(() => live && toast.current('Could not load the people on that list.'))
    return () => {
      live = false
    }
  }, [activeList, lists])

  const current = lists?.find((l) => l.id === activeList)

  function copyEmails() {
    const emails = (members ?? []).map((m) => m.email).filter(Boolean)
    if (!emails.length) return
    navigator.clipboard
      .writeText(emails.join(', '))
      .then(() => onToast(`Copied ${emails.length} email${emails.length === 1 ? '' : 's'}`))
      .catch(() => onToast('Could not copy. Select them from the table instead.'))
  }

  return (
    <div className="lists-view">
      <h2>Lists</h2>
      <div className="dialer-list">
        {lists === null && <p className="list-members-empty">Loading…</p>}
        {(lists ?? []).map((list) => (
          <button
            key={list.id}
            className={`dialer-list-item ${activeList === list.id ? 'active' : ''}`}
            onClick={() => onSelectList(list.id)}
          >
            <span aria-hidden>{list.emoji}</span>
            {list.name}
            <span>({list.count})</span>
          </button>
        ))}
        <button className="create-list" onClick={() => onToast('Create list — wire to database next.')}>
          + Create new list
        </button>
      </div>

      {current && (
        <div className="list-members">
          <div className="list-members-head">
            <h3>
              {current.emoji} {current.name}
            </h3>
            {!!members?.length && (
              <button className="create-list" onClick={copyEmails}>
                Copy all emails
              </button>
            )}
          </div>
          {members === null && <p className="list-members-empty">Loading…</p>}
          {members?.length === 0 && <p className="list-members-empty">Nobody on this list yet.</p>}
          {!!members?.length && (
            <table className="list-members-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} title={m.notes}>
                    <td>{m.name}</td>
                    <td>{m.email}</td>
                    <td>{(m.tags ?? []).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
