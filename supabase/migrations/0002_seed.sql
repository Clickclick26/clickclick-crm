-- Reference data: brands, packages, scripts, objections, contract templates.
-- No fake contacts/calls/agents — those come from real usage and real sign-ups.
-- Placeholder brand phone lines below (main/local) — swap for real Telnyx numbers
-- once Telnyx is wired; personal per-agent lines get added when each agent signs up.

insert into public.brands (id, label) values
  ('clickclick', 'ClickClick'),
  ('clocal', 'CLocal');

insert into public.outbound_numbers (id, label, e164, display, brand_id, region, kind) values
  ('num-cc-main', 'ClickClick main', '+442890010000', '028 9001 0000', 'clickclick', 'belfast', 'main'),
  ('num-cc-london', 'ClickClick London', '+442071234567', '020 7123 4567', 'clickclick', 'london', 'local'),
  ('num-cc-scotland', 'ClickClick Scotland', '+441413456789', '0141 345 6789', 'clickclick', 'scotland', 'local'),
  ('num-cc-wales', 'ClickClick Wales', '+442920123456', '029 2012 3456', 'clickclick', 'wales', 'local'),
  ('num-cl-main', 'CLocal main', '+442890020000', '028 9002 0000', 'clocal', 'belfast', 'main'),
  ('num-cl-london', 'CLocal London', '+442079876543', '020 7987 6543', 'clocal', 'london', 'local'),
  ('num-cl-scotland', 'CLocal Scotland', '+441314567890', '0131 456 7890', 'clocal', 'scotland', 'local'),
  ('num-cl-wales', 'CLocal Wales', '+442920987654', '029 2098 7654', 'clocal', 'wales', 'local');

insert into public.packages (id, brand_id, name, blurb, default_price, default_monthly) values
  ('cc-starter', 'clickclick', 'Starter', 'Live commerce setup + playbooks', 1500, 299),
  ('cc-growth', 'clickclick', 'Growth', 'Starter + social listening', 3200, 599),
  ('cc-partner', 'clickclick', 'Partner stack', 'Full stack + creator support', 6500, 999),
  ('cl-basic', 'clocal', 'Local Basic', 'Business page + pulses', 49, 29),
  ('cl-pro', 'clocal', 'Local Pro', 'Basic + rewards + analytics', 149, 79),
  ('cl-city', 'clocal', 'City launch', 'Multi-location deposit pack', 900, 199);

insert into public.info_kits (id, brand_id, name, blurb, subject) values
  ('cc-brochure', 'clickclick', 'Brochure', 'One-pager overview of ClickClick', 'ClickClick — quick overview for you'),
  ('cc-info', 'clickclick', 'Info kit', 'Deck + case studies + how we work', 'ClickClick info kit'),
  ('cc-live', 'clickclick', 'Live commerce pack', 'Warm-up pack for live shopping chats', 'Live commerce — short pack from ClickClick'),
  ('cl-brochure', 'clocal', 'Brochure', 'CLocal for local businesses', 'CLocal — overview for you'),
  ('cl-info', 'clocal', 'Info kit', 'Pulses, rewards, and getting started', 'CLocal info kit');

insert into public.objections (brand_id, label, reply, sort_order) values
  (null, 'Too expensive', 'Totally fair. Most clients start on a smaller plan and expand once they see one live that pays for itself. Want me to walk through a starter option vs the full stack?', 1),
  (null, 'Already have agency', 'Great — we often sit beside agencies. We supply the software + playbooks; they keep creative. Happy to show a split that doesn''t replace them.', 2),
  (null, 'No time / later', 'Understood. When is a better slot this week — morning or afternoon? I''ll send a calendar hold and a 2-min Loom so it''s easy to prep.', 3),
  (null, 'Send info first', 'Happy to. I''ll email a one-pager + short case study now via Lark. While I have you — what''s the one metric you care about most: views, conversion, or ROAS?', 4),
  (null, 'Competitor quote', 'Makes sense to compare. Where we usually win is human-level video context + live commerce in one place — not just keyword dumps. Want a side-by-side on that?', 5);

insert into public.contract_templates (id, brand_id, pay_type, name, body) values
  ('cc-monthly', 'clickclick', 'monthly', 'ClickClick · Monthly', 'SERVICE AGREEMENT — {{brand}}

Client: {{client_name}} ({{company}})
Start: {{start_date}}
End: {{end_date}}
Packages: {{packages}}
Monthly fee: £{{monthly_amount}}

Payment: card subscription via Stripe.
This agreement is signed electronically.'),
  ('cc-oneoff', 'clickclick', 'one_off', 'ClickClick · One-off', 'SERVICE AGREEMENT — {{brand}}

Client: {{client_name}} ({{company}})
Packages: {{packages}}
Total: £{{total_price}}

Payment: one-off via Stripe.
This agreement is signed electronically.'),
  ('cc-deposit', 'clickclick', 'deposit', 'ClickClick · Deposit', 'SERVICE AGREEMENT — {{brand}}

Client: {{client_name}} ({{company}})
Packages: {{packages}}
Total: £{{total_price}}
Deposit due now: £{{deposit_amount}}

Balance terms as agreed. Signed electronically.'),
  ('cc-dd', 'clickclick', 'direct_debit', 'ClickClick · Direct Debit', 'SERVICE AGREEMENT — {{brand}}

Client: {{client_name}} ({{company}})
Packages: {{packages}}
Monthly Direct Debit: £{{monthly_amount}}

Collected via GoCardless. Signed electronically.'),
  ('cl-monthly', 'clocal', 'monthly', 'CLocal · Monthly', 'CLOCAL AGREEMENT

Client: {{client_name}} ({{company}})
Packages: {{packages}}
Monthly: £{{monthly_amount}}
Start: {{start_date}}

Signed electronically.'),
  ('cl-oneoff', 'clocal', 'one_off', 'CLocal · One-off', 'CLOCAL AGREEMENT

Client: {{client_name}} ({{company}})
Packages: {{packages}}
Total: £{{total_price}}

Signed electronically.'),
  ('cl-deposit', 'clocal', 'deposit', 'CLocal · Deposit', 'CLOCAL AGREEMENT

Client: {{client_name}} ({{company}})
Packages: {{packages}}
Total: £{{total_price}}
Deposit: £{{deposit_amount}}

Signed electronically.'),
  ('cl-dd', 'clocal', 'direct_debit', 'CLocal · Direct Debit', 'CLOCAL AGREEMENT

Client: {{client_name}} ({{company}})
Packages: {{packages}}
Monthly Direct Debit: £{{monthly_amount}}

Signed electronically.');

insert into public.scripts (scope, title, body) values (
  'everyone',
  'Opener · Live Commerce',
  'Hi {{name}}, this is {{agent}} from ClickClick.

We help brands turn video into sales — live shopping, social listening, and creator campaigns.

I saw {{company}} is growing online. Got 60 seconds for why teams book a demo with us?'
);

insert into public.dialer_lists (name, emoji, sort_order) values
  ('Warm demos', '🔥', 1),
  ('Follow-up callbacks', '📞', 2),
  ('Retail UK', '🛍️', 3),
  ('Partner intros', '🤝', 4),
  ('Do not call', '🚫', 5);
