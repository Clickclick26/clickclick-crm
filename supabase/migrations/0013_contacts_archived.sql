-- "Delete" in the CRM archives a contact rather than hard-deleting it.
-- calls.contact_id and deals.contact_id have no ON DELETE rule (default
-- RESTRICT), so a real DELETE on a contact with any call/deal history would
-- throw a foreign-key error mid-scroll. Archiving avoids that entirely, keeps
-- call recordings/coaching notes/deals intact, and is undo-able.
alter table public.contacts
  add column archived_at timestamptz;

create index contacts_archived_at_idx on public.contacts (archived_at);
