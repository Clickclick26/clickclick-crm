import { supabase } from './client'

/**
 * Project boards (Trello-style Kanban), one set per agent.
 *
 * RLS in 0004_boards.sql keeps a board private to its owner — admins included
 * — so every query here is already scoped by the database. Nothing in this
 * module filters by agent id, and it must not start to: doing it in the client
 * would imply the boundary lives here rather than in Postgres.
 */

export type BoardAccent = 'turquoise' | 'purple' | 'pink' | 'amber' | 'ink'
export type LabelColour = 'turquoise' | 'purple' | 'pink' | 'amber' | 'red' | 'slate'
export type CardKind = '' | 'task' | 'grant' | 'competition' | 'support'
export type CardStatus = '' | 'eligible' | 'check' | 'blocked'

export const BOARD_ACCENTS: BoardAccent[] = ['turquoise', 'purple', 'pink', 'amber', 'ink']
export const LABEL_COLOURS: LabelColour[] = ['turquoise', 'purple', 'pink', 'amber', 'red', 'slate']

export const KIND_LABEL: Record<Exclude<CardKind, ''>, string> = {
  task: 'Task',
  grant: 'Grant',
  competition: 'Competition',
  support: 'Support',
}

export const STATUS_LABEL: Record<Exclude<CardStatus, ''>, string> = {
  eligible: 'Clear',
  check: 'Check',
  blocked: 'Blocked',
}

export type Board = {
  id: string
  name: string
  accent: BoardAccent
  shared: boolean
  position: number
}

export type BoardList = {
  id: string
  boardId: string
  name: string
  colour: LabelColour
  position: number
}

export type BoardCard = {
  id: string
  boardId: string
  listId: string
  title: string
  org: string
  kind: CardKind
  amount: number
  dueDate: string
  status: CardStatus
  remindDays: number
  labels: LabelColour[]
  url: string
  notes: string
  position: number
}

export type BoardData = { boards: Board[]; lists: BoardList[]; cards: BoardCard[] }

export type CardDraft = Omit<BoardCard, 'id' | 'boardId' | 'position'>

/** The gap left between adjacent positions, so a card can be dropped between two others. */
const STEP = 10

function fail(action: string, error: { message: string } | null): void {
  if (error) throw new Error(`${action}: ${error.message}`)
}

/**
 * Everything the boards screen needs, in three round trips rather than one per
 * board. Ordering is done in Postgres so a reload can't reshuffle a board.
 */
export async function fetchBoardData(): Promise<BoardData> {
  const [boardRes, listRes, cardRes] = await Promise.all([
    supabase.from('boards').select('*').order('position'),
    supabase.from('board_lists').select('*').order('position'),
    supabase.from('board_cards').select('*').order('position'),
  ])

  fail('Loading boards', boardRes.error)
  fail('Loading lists', listRes.error)
  fail('Loading cards', cardRes.error)

  return {
    boards: (boardRes.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      accent: r.accent,
      shared: r.shared,
      position: r.position,
    })),
    lists: (listRes.data ?? []).map((r) => ({
      id: r.id,
      boardId: r.board_id,
      name: r.name,
      colour: r.colour,
      position: r.position,
    })),
    cards: (cardRes.data ?? []).map((r) => ({
      id: r.id,
      boardId: r.board_id,
      listId: r.list_id,
      title: r.title,
      org: r.org,
      kind: r.kind,
      amount: Number(r.amount) || 0,
      dueDate: r.due_date ?? '',
      status: r.status,
      remindDays: r.remind_days,
      labels: (r.labels ?? []) as LabelColour[],
      url: r.url,
      notes: r.notes,
      position: r.position,
    })),
  }
}

/**
 * Creates the board and its opening lists together. `ownerId` is written
 * explicitly because the RLS check on insert compares it to `auth.uid()` — a
 * missing owner is rejected rather than defaulted.
 */
export async function createBoard(
  ownerId: string,
  name: string,
  accent: BoardAccent,
  listNames: string[],
  position: number,
): Promise<{ board: Board; lists: BoardList[] }> {
  const boardRes = await supabase
    .from('boards')
    .insert({ owner_id: ownerId, name, accent, position })
    .select()
    .single()
  fail('Creating the board', boardRes.error)
  const row = boardRes.data!

  const wanted = listNames.map((n) => n.trim()).filter(Boolean).slice(0, 12)
  const names = wanted.length ? wanted : ['To do', 'Doing', 'Blocked', 'Done']

  const listRes = await supabase
    .from('board_lists')
    .insert(
      names.map((listName, i) => ({
        board_id: row.id,
        name: listName,
        colour: LABEL_COLOURS[i % LABEL_COLOURS.length],
        position: (i + 1) * STEP,
      })),
    )
    .select()
  fail('Creating the lists', listRes.error)

  return {
    board: { id: row.id, name: row.name, accent: row.accent, shared: row.shared, position: row.position },
    lists: (listRes.data ?? []).map((r) => ({
      id: r.id,
      boardId: r.board_id,
      name: r.name,
      colour: r.colour,
      position: r.position,
    })),
  }
}

export async function updateBoard(
  id: string,
  patch: Partial<Pick<Board, 'name' | 'accent' | 'shared' | 'position'>>,
): Promise<void> {
  const { error } = await supabase.from('boards').update(patch).eq('id', id)
  fail('Saving the board', error)
}

/** Lists and cards go with it: both tables cascade on the board's delete. */
export async function deleteBoard(id: string): Promise<void> {
  const { error } = await supabase.from('boards').delete().eq('id', id)
  fail('Deleting the board', error)
}

export async function createList(
  boardId: string,
  name: string,
  colour: LabelColour,
  position: number,
): Promise<BoardList> {
  const { data, error } = await supabase
    .from('board_lists')
    .insert({ board_id: boardId, name, colour, position })
    .select()
    .single()
  fail('Adding the list', error)
  return {
    id: data!.id,
    boardId: data!.board_id,
    name: data!.name,
    colour: data!.colour,
    position: data!.position,
  }
}

export async function updateList(
  id: string,
  patch: Partial<Pick<BoardList, 'name' | 'colour' | 'position'>>,
): Promise<void> {
  const { error } = await supabase.from('board_lists').update(patch).eq('id', id)
  fail('Saving the list', error)
}

export async function deleteList(id: string): Promise<void> {
  const { error } = await supabase.from('board_lists').delete().eq('id', id)
  fail('Deleting the list', error)
}

function cardPayload(boardId: string, draft: CardDraft, position: number) {
  return {
    board_id: boardId,
    list_id: draft.listId,
    title: draft.title,
    org: draft.org,
    kind: draft.kind,
    amount: draft.amount,
    // An empty date input is "no due date", which is NULL — not the empty
    // string, which Postgres rejects for a date column.
    due_date: draft.dueDate || null,
    status: draft.status,
    remind_days: draft.remindDays,
    labels: draft.labels,
    url: draft.url,
    notes: draft.notes,
    position,
  }
}

export async function createCard(
  boardId: string,
  draft: CardDraft,
  position: number,
): Promise<BoardCard> {
  const { data, error } = await supabase
    .from('board_cards')
    .insert(cardPayload(boardId, draft, position))
    .select()
    .single()
  fail('Adding the card', error)
  return {
    ...draft,
    id: data!.id,
    boardId,
    position,
    amount: Number(data!.amount) || 0,
    dueDate: data!.due_date ?? '',
  }
}

export async function updateCard(
  id: string,
  boardId: string,
  draft: CardDraft,
  position: number,
): Promise<void> {
  const { error } = await supabase
    .from('board_cards')
    .update(cardPayload(boardId, draft, position))
    .eq('id', id)
  fail('Saving the card', error)
}

export async function moveCard(id: string, listId: string, position: number): Promise<void> {
  const { error } = await supabase
    .from('board_cards')
    .update({ list_id: listId, position })
    .eq('id', id)
  fail('Moving the card', error)
}

export async function deleteCard(id: string): Promise<void> {
  const { error } = await supabase.from('board_cards').delete().eq('id', id)
  fail('Deleting the card', error)
}

/** Next free position at the end of a list, leaving room to drop between cards. */
export function nextPosition(cards: BoardCard[]): number {
  return cards.reduce((max, c) => Math.max(max, c.position), 0) + STEP
}

/** Whole days from today until `iso`, or null when there is no date. */
export function daysUntil(iso: string): number | null {
  const parts = iso.split('-')
  if (parts.length !== 3) return null
  const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  if (Number.isNaN(due.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}

export function formatMoney(amount: number): string {
  return amount ? `£${amount.toLocaleString('en-GB')}` : ''
}

export function formatDate(iso: string): string {
  const parts = iso.split('-')
  if (parts.length !== 3) return ''
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Cards on `boardId` that have fallen inside their own reminder lead time,
 * soonest first. Blocked cards and anything in the board's last list are
 * excluded: those are decided, and a reminder about them is noise.
 */
export function dueCards(data: BoardData, boardId: string): BoardCard[] {
  const lists = data.lists.filter((l) => l.boardId === boardId).sort((a, b) => a.position - b.position)
  const lastListId = lists.length ? lists[lists.length - 1].id : null

  return data.cards
    .filter((c) => {
      if (c.boardId !== boardId) return false
      if (c.status === 'blocked') return false
      if (lastListId && c.listId === lastListId) return false
      const n = daysUntil(c.dueDate)
      return n !== null && n >= 0 && n <= c.remindDays
    })
    .sort((a, b) => (daysUntil(a.dueDate) ?? 0) - (daysUntil(b.dueDate) ?? 0))
}
