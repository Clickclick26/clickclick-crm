-- 0004_grants.sql granted the raw-SQL-created tables to `authenticated` only.
-- `service_role` bypasses RLS *policies*, but it still needs a plain SQL GRANT
-- to touch a table at all — Supabase's dashboard Table Editor grants that
-- automatically, but tables created via the SQL Editor (all of ours) don't
-- get it. Every edge function that uses the service-role key (screen-tps-ctps,
-- waitlist-ingest, and any future one) has been getting "permission denied for
-- table X" from Postgres itself, independent of any application bug.
grant usage on schema public to service_role;

grant select, insert, update, delete on
  public.agents,
  public.brands,
  public.outbound_numbers,
  public.contacts,
  public.dialer_lists,
  public.dialer_list_members,
  public.calls,
  public.call_feedback,
  public.scripts,
  public.objections,
  public.packages,
  public.info_kits,
  public.contract_templates,
  public.deals,
  public.commission_events,
  public.referrals,
  public.waitlist_signups
to service_role;
