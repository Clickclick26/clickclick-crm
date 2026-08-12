import { DIALER_LISTS } from '../../data/mock'

/**
 * Extracted verbatim from App.tsx's `nav === 'lists'` block — same markup,
 * same classNames, same behavior. Pure JSX extraction only; no logic
 * changed. Part of splitting the 2,900-line App.tsx into per-screen
 * components, one screen at a time, per Kathryn's request.
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
  return (
    <div className="lists-view">
      <h2>Dialer lists</h2>
      <div className="dialer-list">
        {DIALER_LISTS.map((list) => (
          <button
            key={list.id}
            className={`dialer-list-item ${activeList === list.id ? 'active' : ''}`}
            onClick={() => {
              onSelectList(list.id)
              onToast(`Opened list: ${list.name}`)
            }}
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
    </div>
  )
}
