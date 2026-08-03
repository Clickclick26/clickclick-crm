-- Demo/example contacts + calls so the CRM isn't an empty shell on first login.
-- Safe to delete any time — these are the same example leads the approved UI
-- mockup shipped with, just persisted now instead of resetting per browser tab.
-- owner_id / agent_id are left null (no real agents exist until someone signs up);
-- the app falls back to "Unassigned" for those in the UI.

insert into public.contacts
  (id, name, company, phone, email, avatar_url, stage, source, timezone, quiet_hours, do_not_call, notes, tags, next_callback, region)
values
  ('11111111-1111-1111-1111-111111111111', 'Arlene Fisher', 'North Star Retail', '020 7946 0115', 'arlene@northstar.example',
   'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop', 'talking', 'Website demo', 'Europe/London',
   '20:00–08:00 local', false, 'Warm lead. Liked live commerce demo. Budget around £2k/mo. Decision with ops lead next Tue.',
   array['retail', 'warm'], 'Tue 11:00', 'london'),
  ('22222222-2222-2222-2222-222222222222', 'Marcus Hale', 'Bright Cart Co', '0141 555 0109', 'marcus@brightcart.example',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop', 'new', 'LinkedIn', 'Europe/London',
   '21:00–09:00 local', false, 'Asked for pricing sheet. Prefer email follow-up after first call.',
   array['ecommerce'], null, 'scotland'),
  ('33333333-3333-3333-3333-333333333333', 'Priya Desai', 'Oak & Vine', '029 2011 0126', 'priya@oakvine.example',
   'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop', 'proposal', 'Referral', 'Europe/London',
   '19:00–08:00 local', false, 'Comparing us vs agency retainer. Strong on TikTok live.',
   array['beauty', 'hot'], null, 'wales'),
  ('44444444-4444-4444-4444-444444444444', 'Tom Brennan', 'Harbour Foods', '028 9032 0107', 'tom@harbour.example',
   'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop', 'new', 'Trade show', 'Europe/Dublin',
   '20:00–08:00 local', false, 'Left voicemail twice. Best reach mornings.',
   array['food'], null, 'belfast'),
  ('55555555-5555-5555-5555-555555555555', 'Elena Ruiz', 'Studio Lumen', '020 7946 0104', 'elena@lumen.example',
   'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop', 'lost', 'Cold list', 'Europe/Madrid',
   '20:00–09:00 local', true, 'Asked to be removed from call list. Email OK only.',
   array['dnc'], null, 'london'),
  ('66666666-6666-6666-6666-666666666666', 'James Okafor', 'Pulse Media', '028 9024 0124', 'james@pulsemedia.example',
   'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop', 'won', 'Partner intro', 'Europe/London',
   '18:00–08:00 local', false, 'Closed Starter plan. Upsell Social Listening in Q3.',
   array['customer'], null, 'belfast');

insert into public.calls (contact_id, phone, status, extension, occurred_at, duration_sec, recording_url, outcome)
values
  ('11111111-1111-1111-1111-111111111111', '020 7946 0115', 'missed', 'ext. 316', now() - interval '10 minutes', null, null, null),
  ('22222222-2222-2222-2222-222222222222', '0141 555 0109', 'inbound', 'ext. 316', now() - interval '3 days', 214, '#rec-call2', 'callback'),
  ('33333333-3333-3333-3333-333333333333', '029 2011 0126', 'outbound', 'ext. 316', now() - interval '3 days', 482, '#rec-call3', 'sold'),
  ('44444444-4444-4444-4444-444444444444', '028 9032 0107', 'missed', 'ext. 316', now() - interval '3 days', null, null, null),
  ('55555555-5555-5555-5555-555555555555', '020 7946 0104', 'inbound', 'ext. 316', now() - interval '4 days', 96, '#rec-call5', 'do_not_call'),
  ('66666666-6666-6666-6666-666666666666', '028 9024 0124', 'outbound', 'ext. 316', now() - interval '4 days', 640, '#rec-call6', 'sold'),
  ('11111111-1111-1111-1111-111111111111', '020 7946 0115', 'outbound', 'ext. 316', now() - interval '5 days', 318, '#rec-call7', 'callback');
