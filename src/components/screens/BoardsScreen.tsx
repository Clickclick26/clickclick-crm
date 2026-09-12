import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Trash2 } from 'lucide-react'
import {
  BOARD_ACCENTS,
  KIND_LABEL,
  LABEL_COLOURS,
  STATUS_LABEL,
  createBoard,
  createCard,
  createList,
  daysUntil,
  deleteBoard,
  deleteCard,
  deleteList,
  dueCards,
  fetchBoardData,
  formatDate,
  formatMoney,
  moveCard,
  nextPosition,
  updateBoard,
  updateCard,
  updateList,
  type BoardAccent,
  type BoardCard,
  type BoardData,
  type CardDraft,
  type CardKind,
  type CardStatus,
  type LabelColour,
} from '../../lib/supabase/boards'

const EMPTY: BoardData = { boards: [], lists: [], cards: [] }

const BLANK_DRAFT: CardDraft = {
  listId: '',
  title: '',
  org: '',
  kind: 'task',
  amount: 0,
  dueDate: '',
  status: '',
  remindDays: 14,
  labels: [],
  url: '',
  notes: '',
}

type StatusFilter = 'all' | 'eligible' | 'check' | 'blocked'

/**
 * Personal project boards. Private per agent — see the RLS notes in
 * 0004_boards.sql; nothing here filters by agent id because Postgres already
 * has.
 */
export function BoardsScreen({
  agentId,
  onToast,
}: {
  agentId: string
  onToast: (message: string) => void
}) {
  const [data, setData] = useState<BoardData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')

  const [cardOpen, setCardOpen] = useState(false)
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CardDraft>(BLANK_DRAFT)

  const [boardOpen, setBoardOpen] = useState(false)
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null)
  const [boardName, setBoardName] = useState('')
  const [boardAccent, setBoardAccent] = useState<BoardAccent>('turquoise')
  const [boardLists, setBoardLists] = useState('')

  const dragged = useRef<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const next = await fetchBoardData()
      setData(next)
      setActiveId((current) => {
        if (current && next.boards.some((b) => b.id === current)) return current
        return next.boards.length ? next.boards[0].id : null
      })
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not load your boards.')
    } finally {
      setLoading(false)
    }
  }, [onToast])

  useEffect(() => {
    void reload()
  }, [reload])

  const board = useMemo(
    () => data.boards.find((b) => b.id === activeId) ?? null,
    [data.boards, activeId],
  )

  const lists = useMemo(
    () => data.lists.filter((l) => l.boardId === activeId).sort((a, b) => a.position - b.position),
    [data.lists, activeId],
  )

  const cardsOnBoard = useMemo(
    () => data.cards.filter((c) => c.boardId === activeId),
    [data.cards, activeId],
  )

  const matches = useCallback(
    (card: BoardCard) => {
      if (filter !== 'all' && card.status !== filter) return false
      if (!search) return true
      const q = search.toLowerCase()
      return [card.title, card.org, card.notes].join(' ').toLowerCase().includes(q)
    },
    [filter, search],
  )

  const cardsIn = useCallback(
    (listId: string) =>
      cardsOnBoard.filter((c) => c.listId === listId).sort((a, b) => a.position - b.position),
    [cardsOnBoard],
  )

  // ---- summary -------------------------------------------------------------
  const lastListId = lists.length ? lists[lists.length - 1].id : null
  const live = cardsOnBoard.filter(
    (c) => c.status !== 'blocked' && (!lastListId || c.listId !== lastListId),
  )
  const nextDue = live
    .filter((c) => {
      const n = daysUntil(c.dueDate)
      return n !== null && n >= 0
    })
    .sort((a, b) => (daysUntil(a.dueDate) ?? 0) - (daysUntil(b.dueDate) ?? 0))[0]
  const valueInPlay = live.reduce((sum, c) => sum + c.amount, 0)
  const reminders = activeId ? dueCards(data, activeId) : []

  // ---- mutations -----------------------------------------------------------
  async function run(action: () => Promise<void>, failure: string) {
    try {
      await action()
      await reload()
    } catch (err) {
      onToast(err instanceof Error ? err.message : failure)
    }
  }

  function openCard(card: BoardCard | null, listId: string) {
    setEditingCardId(card?.id ?? null)
    setDraft(
      card
        ? {
            listId: card.listId,
            title: card.title,
            org: card.org,
            kind: card.kind,
            amount: card.amount,
            dueDate: card.dueDate,
            status: card.status,
            remindDays: card.remindDays,
            labels: card.labels,
            url: card.url,
            notes: card.notes,
          }
        : { ...BLANK_DRAFT, listId },
    )
    setCardOpen(true)
  }

  async function saveCard() {
    if (!board) return
    const title = draft.title.trim()
    if (!title) {
      onToast('Give the card a title.')
      return
    }
    if (!draft.listId) {
      onToast('Add a list to this board first.')
      return
    }
    const clean: CardDraft = { ...draft, title, org: draft.org.trim(), url: draft.url.trim() }
    const existing = editingCardId ? data.cards.find((c) => c.id === editingCardId) : null
    setCardOpen(false)
    await run(async () => {
      if (existing) {
        await updateCard(existing.id, board.id, clean, existing.position)
      } else {
        await createCard(board.id, clean, nextPosition(cardsIn(clean.listId)))
      }
    }, 'Could not save the card.')
  }

  async function handleDrop(listId: string) {
    setDropTarget(null)
    const id = dragged.current
    dragged.current = null
    const card = data.cards.find((c) => c.id === id)
    if (!card || card.listId === listId) return
    await run(() => moveCard(card.id, listId, nextPosition(cardsIn(listId))), 'Could not move the card.')
  }

  async function shift(card: BoardCard, direction: -1 | 1) {
    const index = lists.findIndex((l) => l.id === card.listId)
    const target = lists[index + direction]
    if (!target) return
    await run(() => moveCard(card.id, target.id, nextPosition(cardsIn(target.id))), 'Could not move the card.')
  }

  function openBoard(id: string | null) {
    const existing = id ? data.boards.find((b) => b.id === id) ?? null : null
    setEditingBoardId(existing?.id ?? null)
    setBoardName(existing?.name ?? '')
    setBoardAccent(existing?.accent ?? BOARD_ACCENTS[data.boards.length % BOARD_ACCENTS.length])
    setBoardLists('')
    setBoardOpen(true)
  }

  async function saveBoard() {
    const name = boardName.trim()
    if (!name) {
      onToast('Give the board a name.')
      return
    }
    const editing = editingBoardId
    const names = boardLists.split('\n')
    setBoardOpen(false)
    await run(async () => {
      if (editing) {
        await updateBoard(editing, { name, accent: boardAccent })
        return
      }
      const position = data.boards.reduce((max, b) => Math.max(max, b.position), 0) + 10
      const made = await createBoard(agentId, name, boardAccent, names, position)
      setActiveId(made.board.id)
    }, 'Could not save the board.')
  }

  function copyReminders() {
    if (!board) return
    if (!reminders.length) {
      onToast('Nothing due inside its lead time on this board.')
      return
    }
    const lines = [`${board.name} — coming up`, '']
    reminders.forEach((c) => {
      const n = daysUntil(c.dueDate) ?? 0
      lines.push(`• ${c.title}${c.org ? ` (${c.org})` : ''}`)
      lines.push(
        `  ${n === 0 ? 'Due today' : `Due in ${n} days`}, ${formatDate(c.dueDate)}` +
          (c.amount ? `, worth up to ${formatMoney(c.amount)}` : ''),
      )
      if (c.url) lines.push(`  ${c.url}`)
      if (c.notes) lines.push(`  ${c.notes}`)
      lines.push('')
    })
    void navigator.clipboard?.writeText(lines.join('\n'))
    onToast('Reminder list copied.')
  }

  function duePill(card: BoardCard): { tone: string; text: string } | null {
    const n = daysUntil(card.dueDate)
    if (n === null) return null
    if (n < 0) return { tone: 'mute', text: `Was ${formatDate(card.dueDate)}` }
    if (n === 0) return { tone: 'bad', text: 'Due today' }
    if (n <= 7) return { tone: 'bad', text: `${n} day${n === 1 ? '' : 's'} left` }
    if (n <= 21) return { tone: 'warn', text: `${n} days left` }
    return { tone: 'ok', text: formatDate(card.dueDate) }
  }

  if (loading) {
    return (
      <div className="lists-view">
        <div className="pipeline-head">
          <h2>Boards</h2>
          <p className="muted" style={{ margin: 0 }}>
            Loading your boards…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`lists-view boards-view accent-${board?.accent ?? 'ink'}`}>
      <div className="pipeline-head">
        <h2>Boards</h2>
        <p className="muted" style={{ margin: 0 }}>
          Your own boards. Nobody else on the team can see them, admins included.
        </p>
      </div>

      <div className="tabs board-tabs">
        {data.boards.map((b) => (
          <button
            key={b.id}
            className={`tab ${b.id === activeId ? 'active' : ''}`}
            onClick={() => {
              setActiveId(b.id)
              setSearch('')
            }}
          >
            <span className={`board-swatch accent-${b.accent}`} />
            {b.name}
            <span className="board-count">
              {data.cards.filter((c) => c.boardId === b.id).length}
            </span>
          </button>
        ))}
        <button className="tab" onClick={() => openBoard(null)}>
          + New board
        </button>
      </div>

      {!board ? (
        <p className="board-empty-state">
          No boards yet. Make one with <strong>+ New board</strong>, name your lists, and start
          adding cards.
        </p>
      ) : (
        <>
          <div className="board-toolbar">
            <button className="link-btn" onClick={() => openBoard(board.id)}>
              Rename
            </button>
            <button
              className="link-btn danger"
              onClick={() => {
                if (cardsOnBoard.length) {
                  onToast(`Empty the ${cardsOnBoard.length} card(s) on this board first.`)
                  return
                }
                if (!window.confirm(`Delete the board "${board.name}" and its lists?`)) return
                void run(() => deleteBoard(board.id), 'Could not delete the board.')
              }}
            >
              Delete board
            </button>
            <input
              className="board-search"
              type="search"
              value={search}
              placeholder="Search this board"
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="board-filters">
              {(['all', 'eligible', 'check', 'blocked'] as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  className={`chip ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'All' : STATUS_LABEL[f]}
                </button>
              ))}
            </div>
            <button className="link-btn" onClick={copyReminders}>
              <Copy size={14} /> Copy reminders
            </button>
          </div>

          <div className="board-summary">
            <div className={`board-tile ${nextDue && (daysUntil(nextDue.dueDate) ?? 99) <= 7 ? 'urgent' : ''}`}>
              <span className="k">Next due</span>
              <span className="v">
                {nextDue
                  ? (daysUntil(nextDue.dueDate) === 0
                      ? 'Today'
                      : `${daysUntil(nextDue.dueDate)} days`)
                  : '—'}
              </span>
              <span className="sub">{nextDue ? nextDue.title : 'Nothing dated on this board'}</span>
            </div>
            <div className="board-tile">
              <span className="k">Cards in play</span>
              <span className="v">{live.length}</span>
              <span className="sub">{cardsOnBoard.length} on the board in total</span>
            </div>
            {valueInPlay > 0 && (
              <div className="board-tile">
                <span className="k">Value in play</span>
                <span className="v">{formatMoney(valueInPlay)}</span>
                <span className="sub">Sum of amounts still live</span>
              </div>
            )}
            <div className="board-tile">
              <span className="k">Needs a check</span>
              <span className="v">{cardsOnBoard.filter((c) => c.status === 'check').length}</span>
              <span className="sub">
                {cardsOnBoard.filter((c) => c.status === 'blocked').length} blocked
              </span>
            </div>
          </div>

          <div className="board-canvas">
            {lists.map((list, index) => {
              const all = cardsIn(list.id)
              const shown = all.filter(matches)
              return (
                <section
                  key={list.id}
                  className={`board-list ${dropTarget === list.id ? 'dropping' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDropTarget(list.id)
                  }}
                  onDragLeave={() => setDropTarget((t) => (t === list.id ? null : t))}
                  onDrop={(e) => {
                    e.preventDefault()
                    void handleDrop(list.id)
                  }}
                >
                  <div className="board-list-head">
                    <span className={`board-dot label-${list.colour}`} />
                    <h3>{list.name}</h3>
                    <span className="board-count">
                      {shown.length === all.length ? all.length : `${shown.length}/${all.length}`}
                    </span>
                    <button
                      className="icon-btn"
                      title="Rename list"
                      aria-label={`Rename list ${list.name}`}
                      onClick={() => {
                        const name = window.prompt('Rename list', list.name)
                        if (name && name.trim()) {
                          void run(() => updateList(list.id, { name: name.trim() }), 'Could not rename the list.')
                        }
                      }}
                    >
                      ✎
                    </button>
                    <button
                      className="icon-btn"
                      title="Delete list"
                      aria-label={`Delete list ${list.name}`}
                      onClick={() => {
                        if (all.length) {
                          onToast(`Move or delete the ${all.length} card(s) in this list first.`)
                          return
                        }
                        if (!window.confirm(`Delete the list "${list.name}"?`)) return
                        void run(() => deleteList(list.id), 'Could not delete the list.')
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="board-list-body">
                    {shown.length === 0 && (
                      <p className="board-list-empty">{all.length ? 'Nothing matches' : 'Empty'}</p>
                    )}
                    {shown.map((card) => {
                      const pill = duePill(card)
                      return (
                        <article
                          key={card.id}
                          className="board-card"
                          draggable
                          tabIndex={0}
                          onDragStart={() => {
                            dragged.current = card.id
                          }}
                          onClick={() => openCard(card, list.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              openCard(card, list.id)
                            }
                            if (e.key === 'ArrowRight') {
                              e.preventDefault()
                              void shift(card, 1)
                            }
                            if (e.key === 'ArrowLeft') {
                              e.preventDefault()
                              void shift(card, -1)
                            }
                          }}
                        >
                          {card.labels.length > 0 && (
                            <div className="board-labels">
                              {card.labels.map((l) => (
                                <span key={l} className={`label-${l}`} />
                              ))}
                            </div>
                          )}
                          <h4>{card.title}</h4>
                          {(card.org || card.kind) && (
                            <div className="board-card-org">
                              {[card.org, card.kind ? KIND_LABEL[card.kind] : '']
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          )}
                          {card.amount > 0 && (
                            <div className="board-card-money">{formatMoney(card.amount)}</div>
                          )}
                          <div className="board-badges">
                            {pill && <span className={`board-pill ${pill.tone}`}>{pill.text}</span>}
                            {card.status && (
                              <span
                                className={`board-pill ${
                                  card.status === 'eligible'
                                    ? 'ok'
                                    : card.status === 'check'
                                      ? 'warn'
                                      : 'bad'
                                }`}
                              >
                                {STATUS_LABEL[card.status]}
                              </span>
                            )}
                            <span className="board-movers">
                              <button
                                className="mover"
                                disabled={index === 0}
                                aria-label={`Move ${card.title} to the previous list`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void shift(card, -1)
                                }}
                              >
                                <ChevronLeft size={14} />
                              </button>
                              <button
                                className="mover"
                                disabled={index === lists.length - 1}
                                aria-label={`Move ${card.title} to the next list`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void shift(card, 1)
                                }}
                              >
                                <ChevronRight size={14} />
                              </button>
                            </span>
                          </div>
                        </article>
                      )
                    })}
                  </div>

                  <button className="board-add-card" onClick={() => openCard(null, list.id)}>
                    + Add a card
                  </button>
                </section>
              )
            })}

            <button
              className="board-add-list"
              onClick={() => {
                const name = window.prompt('Name the list')
                if (!name || !name.trim()) return
                const position = (lists.length ? lists[lists.length - 1].position : 0) + 10
                void run(
                  () =>
                    createList(
                      board.id,
                      name.trim(),
                      LABEL_COLOURS[lists.length % LABEL_COLOURS.length],
                      position,
                    ).then(() => undefined),
                  'Could not add the list.',
                )
              }}
            >
              + Add another list
            </button>
          </div>

          <section className="board-reminders">
            <h3>Reminder queue</h3>
            <p className="muted">
              Cards whose due date has fallen inside their own lead time. Copy the list, or let the
              scheduled job read these and send them through Lark Mail.
            </p>
            {reminders.length === 0 ? (
              <p className="board-reminders-none">
                Nothing due inside its lead time. Give a card a due date and a lead to queue one.
              </p>
            ) : (
              <ul className="board-reminders-list">
                {reminders.map((c) => {
                  const n = daysUntil(c.dueDate) ?? 0
                  return (
                    <li key={c.id}>
                      <span className="when">{n === 0 ? 'Today' : `${n} day${n === 1 ? '' : 's'}`}</span>
                      <span className="what">{c.title}</span>
                      <span className="who">
                        {[c.org, formatMoney(c.amount), `due ${formatDate(c.dueDate)}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {cardOpen && (
        <div className="board-modal-backdrop" onClick={() => setCardOpen(false)}>
          <div className="board-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingCardId ? 'Edit card' : 'Add card'}</h3>
            <div className="board-fields">
              <label>
                Title
                <input
                  value={draft.title}
                  autoFocus
                  maxLength={140}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </label>
              <div className="board-field-label">Labels</div>
              <div className="board-swatches">
                {LABEL_COLOURS.map((l) => (
                  <button
                    key={l}
                    className={`label-${l} ${draft.labels.includes(l) ? 'picked' : ''}`}
                    aria-label={`Label ${l}`}
                    aria-pressed={draft.labels.includes(l)}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        labels: draft.labels.includes(l)
                          ? draft.labels.filter((x) => x !== l)
                          : [...draft.labels, l as LabelColour],
                      })
                    }
                  />
                ))}
              </div>
              <div className="board-pair">
                <label>
                  Org, funder or owner
                  <input
                    value={draft.org}
                    maxLength={90}
                    onChange={(e) => setDraft({ ...draft, org: e.target.value })}
                  />
                </label>
                <label>
                  Type
                  <select
                    value={draft.kind}
                    onChange={(e) => setDraft({ ...draft, kind: e.target.value as CardKind })}
                  >
                    <option value="">None</option>
                    <option value="task">Task</option>
                    <option value="grant">Grant</option>
                    <option value="competition">Competition</option>
                    <option value="support">Free support</option>
                  </select>
                </label>
              </div>
              <div className="board-pair">
                <label>
                  Due date
                  <input
                    type="date"
                    value={draft.dueDate}
                    onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                  />
                </label>
                <label>
                  Remind days before
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={draft.remindDays}
                    onChange={(e) => setDraft({ ...draft, remindDays: Number(e.target.value) || 0 })}
                  />
                </label>
              </div>
              <div className="board-pair">
                <label>
                  Amount £ (0 hides it)
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={draft.amount}
                    onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  Status
                  <select
                    value={draft.status}
                    onChange={(e) => setDraft({ ...draft, status: e.target.value as CardStatus })}
                  >
                    <option value="">None</option>
                    <option value="eligible">Clear to go</option>
                    <option value="check">Needs a check</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </label>
              </div>
              <label>
                List
                <select
                  value={draft.listId}
                  onChange={(e) => setDraft({ ...draft, listId: e.target.value })}
                >
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Link
                <input
                  type="url"
                  value={draft.url}
                  placeholder="https://"
                  onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                />
              </label>
              <label>
                Notes
                <textarea
                  value={draft.notes}
                  maxLength={1400}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </label>
            </div>
            <div className="board-modal-foot">
              {editingCardId && (
                <button
                  className="link-btn danger"
                  onClick={() => {
                    const id = editingCardId
                    setCardOpen(false)
                    void run(() => deleteCard(id), 'Could not delete the card.')
                  }}
                >
                  Delete
                </button>
              )}
              <span className="spacer" />
              <button className="link-btn" onClick={() => setCardOpen(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={() => void saveCard()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {boardOpen && (
        <div className="board-modal-backdrop" onClick={() => setBoardOpen(false)}>
          <div className="board-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingBoardId ? 'Rename board' : 'New board'}</h3>
            <div className="board-fields">
              <label>
                Board name
                <input
                  value={boardName}
                  autoFocus
                  maxLength={60}
                  onChange={(e) => setBoardName(e.target.value)}
                />
              </label>
              <div className="board-field-label">Colour</div>
              <div className="board-swatches">
                {BOARD_ACCENTS.map((a) => (
                  <button
                    key={a}
                    className={`accent-swatch accent-${a} ${boardAccent === a ? 'picked' : ''}`}
                    aria-label={`Colour ${a}`}
                    aria-pressed={boardAccent === a}
                    onClick={() => setBoardAccent(a)}
                  />
                ))}
              </div>
              {!editingBoardId && (
                <label>
                  Lists, one per line
                  <textarea
                    value={boardLists}
                    placeholder={'To do\nDoing\nBlocked\nDone'}
                    onChange={(e) => setBoardLists(e.target.value)}
                  />
                </label>
              )}
            </div>
            <div className="board-modal-foot">
              <span className="spacer" />
              <button className="link-btn" onClick={() => setBoardOpen(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={() => void saveBoard()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
