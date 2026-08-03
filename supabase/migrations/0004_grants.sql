-- Tables created via raw SQL (SQL Editor) don't get Supabase's usual
-- auto-grants for the `authenticated` role the way the dashboard Table
-- Editor does — RLS policies alone aren't enough without this.

grant usage on schema public to authenticated;

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
  public.commission_events
to authenticated;
