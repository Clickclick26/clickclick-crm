-- Boards tables were created through the SQL Editor, so they need the same
-- explicit grants as every other table here — see 0004_grants.sql and
-- 0012_service_role_grants.sql. Without these, Postgres refuses the query
-- before RLS is ever consulted ("permission denied for table boards"),
-- which is what the Boards screen hit on first load.
--
-- Grants are idempotent; re-running this is safe.

grant select, insert, update, delete on
  public.boards,
  public.board_lists,
  public.board_cards
to authenticated;

-- service_role for the reminder job: it bypasses RLS policies, but still
-- needs the plain SQL grant to touch the tables at all.
grant select, insert, update, delete on
  public.boards,
  public.board_lists,
  public.board_cards
to service_role;
