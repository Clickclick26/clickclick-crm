-- Make a failed CRM contact sync visible instead of silent.
--
-- The problem (found 2026-09-13): waitlist-ingest wraps its contacts
-- insert/update in "best-effort... never fail the waitlist" try/catch. On
-- failure it sets contactSyncStatus = 'failed', console.warn()s, returns the
-- status in the HTTP response, and that is the end of it. The browser ignores
-- the field, nothing is persisted, and the signup reports success. So a person
-- can tick the newsletter box, be told they are on the list, and never become a
-- contact — with no row anywhere recording that it went wrong.
--
-- waitlist_signups.contact_id (migration 0009) was designed to hold exactly
-- this link and has never been written to. It is null on every row, so it
-- cannot currently distinguish "sync failed" from "never tried".
--
-- These columns mirror confirm_email_status / confirm_email_error, which the
-- same function already persists for the confirmation email. Matching the
-- habit of the code next to it (AGENTS.md Rule 2) rather than inventing a
-- second pattern.
--
-- `if not exists` throughout: the live table already carries columns that
-- appear in no migration (confirm_email_status, confirm_email_error, raw),
-- added directly in the dashboard. This file must be safe to run against a
-- table that is ahead of the repo.

-- APPLIED TO PRODUCTION 2026-09-13 via the SQL editor, in this exact form.
--
-- contact_id is added here too. Migration 0009 declares it, but the live
-- table has never had it: the first run of this file failed with
-- 42703 "column contact_id of relation public.waitlist_signups does not
-- exist" and rolled back. The live table is not what 0009 describes --
-- brand_id, ip_hash and user_agent are also absent, while
-- confirm_email_status, confirm_email_error and raw exist without appearing
-- in any migration. Treat information_schema, not the migration history, as
-- the truth for this table.

alter table public.waitlist_signups
  add column if not exists contact_id uuid,
  add column if not exists contact_sync_status text not null default 'pending',
  add column if not exists contact_sync_error text;

-- FK only if contacts exists and the constraint is not already there, so this
-- is safe to re-run and safe on a database where 0009 never fully applied.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='contacts')
     and not exists (select 1 from information_schema.table_constraints
                     where table_schema='public'
                       and table_name='waitlist_signups'
                       and constraint_name='waitlist_signups_contact_id_fkey')
  then
    alter table public.waitlist_signups
      add constraint waitlist_signups_contact_id_fkey
      foreign key (contact_id) references public.contacts(id) on delete set null;
  end if;
end $$;

create index if not exists waitlist_signups_contact_id_idx
  on public.waitlist_signups (contact_id);

-- Backfill, run once on 2026-09-13: link the signups that already had a
-- matching contact by email. 9 of 19 rows linked. contact_sync_status stays
-- 'pending' on every pre-existing row on purpose -- nothing recorded what
-- happened at the time, and writing 'created' or 'updated' would be inventing
-- history. 'pending' honestly means "unknown, predates this fix".
update public.waitlist_signups w
set contact_id = c.id
from public.contacts c
where lower(c.email) = lower(w.email)
  and w.contact_id is null;

comment on column public.waitlist_signups.contact_sync_status is
  'pending | created | updated | failed. Written by waitlist-ingest after the CRM contacts write. "failed" means the person is on the waitlist but is NOT in contacts.';
comment on column public.waitlist_signups.contact_sync_error is
  'Postgres/PostgREST error message from the failed contacts write, for diagnosis. Null when the sync succeeded.';
comment on column public.waitlist_signups.contact_id is
  'The contacts row this signup created or matched. Null means no contact exists for this signup — check contact_sync_status for whether that is a failure or a not-yet-attempted row.';

-- The query this exists to make possible: who ticked newsletter and is not
-- actually in the CRM.
create index if not exists waitlist_signups_contact_sync_status_idx
  on public.waitlist_signups (contact_sync_status)
  where contact_sync_status <> 'created';
