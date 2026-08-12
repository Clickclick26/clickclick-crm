-- CLocal outreach needs finer categorization than one flat 'cold-outreach' tag —
-- Kathryn wants industry (cafes/coffee shops, beauty salons, flower shops, etc.)
-- and location tracked per contact.
--
-- Industry reuses CLocal's own app taxonomy exactly
-- (CLocal/constants/categories.ts FILTER_CATEGORIES) rather than inventing a
-- parallel list — that file's own comment says not to, and it keeps CRM outreach
-- data lined up with how these businesses actually get categorized once live.
alter table public.contacts
  add column industry text
    check (industry is null or industry in ('Dining', 'Wellness', 'Nightlife', 'Retail', 'Coffee', 'Events'));

-- Freeform neighbourhood/area (e.g. "Lisburn Road", "Stranmillis"). Belfast doesn't
-- have a fixed area enum anywhere in this codebase yet, so this stays free text
-- rather than guessing a list — can become a real enum later if one emerges.
alter table public.contacts
  add column locality text not null default '';

create index contacts_industry_idx on public.contacts (industry);
