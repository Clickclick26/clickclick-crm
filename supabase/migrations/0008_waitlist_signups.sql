-- CLocal waitlist raw sign-ups (audit trail). Contacts still get the CRM row.
-- Public writes happen only via the waitlist-ingest edge function (service role).

create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  postcode text not null default '',
  roles text[] not null default '{}',
  newsletter boolean not null default true,
  brand_id text not null default 'clocal' references public.brands (id),
  source text not null default 'clocal-waitlist',
  contact_id uuid references public.contacts (id),
  ip_hash text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now()
);

create index waitlist_signups_email_idx on public.waitlist_signups (lower(email));
create index waitlist_signups_created_at_idx on public.waitlist_signups (created_at desc);
create index waitlist_signups_contact_id_idx on public.waitlist_signups (contact_id);

alter table public.waitlist_signups enable row level security;

-- Agents can read waitlist history in the CRM. No anon/public grants.
create policy waitlist_signups_select on public.waitlist_signups
  for select to authenticated using (true);

grant select on public.waitlist_signups to authenticated;
