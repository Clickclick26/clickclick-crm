-- PECR requires screening every number against TPS (individuals/sole traders)
-- and CTPS (corporate subscribers) before an unsolicited marketing call —
-- regardless of how public the number is. "Registered" and "publicly listed"
-- are unrelated; a business can list its number on its own website and still
-- be registered against exactly this kind of call.
--
-- 'unscreened' is the safe default for every existing + new row: the dialer
-- (once real calling exists) should treat unscreened the same as registered
-- until a check actually clears it.
alter table public.contacts
  add column tps_status text not null default 'unscreened'
    check (tps_status in ('unscreened', 'clear', 'tps_registered', 'ctps_registered', 'check_failed')),
  add column tps_screened_at timestamptz;

create index contacts_tps_status_idx on public.contacts (tps_status);

-- Screening only makes sense for real outbound targets, not internal
-- ClickClick/CLocal state, and it's meaningless without a phone number.
comment on column public.contacts.tps_status is
  'PECR TPS/CTPS screening result. unscreened = never checked (treat as blocked). Re-check at least every 28 days per ICO guidance — see tps_screened_at.';
