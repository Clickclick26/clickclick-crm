-- One row per click on a clocal.co.uk/r/<slug>/ redirect page.
-- No IP, no user agent, no identifier: this is a counter, not analytics.
create table if not exists public.link_clicks (
  id         bigserial primary key,
  slug       text        not null,
  campaign   text,
  clicked_at timestamptz not null default now()
);

create index if not exists link_clicks_slug_time
  on public.link_clicks (slug, clicked_at desc);

-- The edge function writes with the service role, so no anon policy is needed
-- and none is granted. Nothing client-side can read or write this table.
grant select, insert on public.link_clicks to service_role;
grant usage, select on sequence public.link_clicks_id_seq to service_role;
