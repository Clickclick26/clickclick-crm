-- contacts had no brand_id at all, unlike deals/packages/objections/outbound_numbers/
-- info_kits/contract_templates, which all already scope by brand. That's fine while
-- every contact is a ClickClick sales lead, but CLocal's waitlist is about to start
-- writing into this same table (see docs/clocal-waitlist-ingest.md) and those
-- signups are not sales leads — they should never sit in the same dialer/pipeline
-- view ClickClick agents work from.
--
-- Every existing row really is ClickClick today, so that's the safe default.
-- New CLocal-sourced contacts (waitlist-ingest edge function) set 'clocal' explicitly.
alter table public.contacts
  add column brand_id text not null default 'clickclick' references public.brands (id);

create index contacts_brand_id_idx on public.contacts (brand_id);
