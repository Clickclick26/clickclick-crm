-- ClickClick CRM — project boards (Trello-style Kanban)
--
-- PRIVATE BY DEFAULT. A board belongs to exactly one agent. Nobody else can
-- read it, admins included: `is_admin()` is deliberately absent from every
-- policy below. A new agent signing in sees no boards at all until they make
-- their own. An owner can opt a single board into team visibility by setting
-- `shared = true`, which grants read only — writes stay with the owner.

-- ---------------------------------------------------------------------------
-- boards
-- ---------------------------------------------------------------------------
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.agents (id) on delete cascade,
  name text not null,
  accent text not null default 'turquoise'
    check (accent in ('turquoise', 'purple', 'pink', 'amber', 'ink')),
  shared boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index boards_owner_idx on public.boards (owner_id, position);

-- ---------------------------------------------------------------------------
-- board_lists (the columns on a board)
-- ---------------------------------------------------------------------------
create table public.board_lists (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  name text not null,
  colour text not null default 'slate'
    check (colour in ('turquoise', 'purple', 'pink', 'amber', 'red', 'slate')),
  position integer not null default 0
);

create index board_lists_board_idx on public.board_lists (board_id, position);

-- ---------------------------------------------------------------------------
-- board_cards
--
-- One card shape covers plain tasks and funding opportunities: `amount`,
-- `due_date` and `status` are optional and the UI hides the badge when unset,
-- so a task card doesn't render as a half-empty grant form.
-- ---------------------------------------------------------------------------
create table public.board_cards (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  list_id uuid not null references public.board_lists (id) on delete cascade,
  title text not null,
  org text not null default '',            -- funder, client or owner
  kind text not null default ''
    check (kind in ('', 'task', 'grant', 'competition', 'support')),
  amount numeric(12, 2) not null default 0,
  due_date date,
  status text not null default ''
    check (status in ('', 'eligible', 'check', 'blocked')),
  remind_days integer not null default 14 check (remind_days between 0 and 365),
  labels text[] not null default '{}',
  url text not null default '',
  notes text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index board_cards_list_idx on public.board_cards (list_id, position);
create index board_cards_board_idx on public.board_cards (board_id);
-- Partial index: the reminder job only ever queries dated cards.
create index board_cards_due_idx on public.board_cards (due_date)
  where due_date is not null;

create function public.touch_board_card()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger board_cards_touch
  before update on public.board_cards
  for each row execute function public.touch_board_card();

-- ---------------------------------------------------------------------------
-- Ownership helpers used by the policies below.
-- security definer so the policy on `boards` doesn't recurse when the child
-- tables check it.
-- ---------------------------------------------------------------------------
create function public.owns_board(board uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.boards b where b.id = board and b.owner_id = auth.uid()
  );
$$;

create function public.can_read_board(board uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.boards b
    where b.id = board and (b.owner_id = auth.uid() or b.shared)
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.boards enable row level security;
alter table public.board_lists enable row level security;
alter table public.board_cards enable row level security;

create policy boards_select on public.boards for select to authenticated
  using (owner_id = auth.uid() or shared);
create policy boards_owner_write on public.boards for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy board_lists_select on public.board_lists for select to authenticated
  using (public.can_read_board(board_id));
create policy board_lists_owner_write on public.board_lists for all to authenticated
  using (public.owns_board(board_id))
  with check (public.owns_board(board_id));

create policy board_cards_select on public.board_cards for select to authenticated
  using (public.can_read_board(board_id));
create policy board_cards_owner_write on public.board_cards for all to authenticated
  using (public.owns_board(board_id))
  with check (public.owns_board(board_id));
