-- ClickClick CRM — "Awards" and "Accelerators" boards.
--
-- Researched 6 Sep 2026. Same shape as the trade-missions import: fixed ids,
-- so re-running UPDATES the boards in place rather than duplicating them.
-- Safe to run as many times as you like.
--
-- Run in the Supabase SQL editor for project gapybapywpdogexibtgj.

do $$
declare
  v_owner uuid;
begin
  -- agents has no email column; the address lives on auth.users.
  select a.id into v_owner
  from public.agents a
  join auth.users u on u.id = a.id
  where lower(u.email) = 'kathryn@clickclick.video';

  if v_owner is null then
    raise exception 'No agent found for kathryn@clickclick.video. Check auth.users, or hard-code the agent id.';
  end if;

  -- Remove the empty "Awards" board created by hand in the CRM UI on 6 Sep 2026
  -- before this import existed. Guarded three ways: hers only, that exact name,
  -- and only when it holds no cards. The real board below has a fixed id.
  delete from public.boards b
  where b.owner_id = v_owner
    and b.name = 'Awards'
    and b.id <> 'ab000000-0000-4000-8000-000000000001'
    and not exists (select 1 from public.board_cards c where c.board_id = b.id);

  -- ---------------------------------------------------------------------------
  -- Boards
  -- ---------------------------------------------------------------------------
  insert into public.boards (id, owner_id, name, accent, shared, position) values
    ('ab000000-0000-4000-8000-000000000001', v_owner, 'Awards', 'amber', false, 40),
    ('ac000000-0000-4000-8000-000000000001', v_owner, 'Accelerators', 'purple', false, 50)
  on conflict (id) do update
    set name = excluded.name, accent = excluded.accent, position = excluded.position;

  -- ---------------------------------------------------------------------------
  -- Lists (same shape as the grants board so the workflow is familiar)
  -- ---------------------------------------------------------------------------
  insert into public.board_lists (id, board_id, name, colour, position) values
    ('ab100000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001', 'Watching',   'slate',     0),
    ('ab100000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000001', 'Open now',   'amber',     1),
    ('ab100000-0000-4000-8000-000000000003', 'ab000000-0000-4000-8000-000000000001', 'Writing',    'purple',    2),
    ('ab100000-0000-4000-8000-000000000004', 'ab000000-0000-4000-8000-000000000001', 'Submitted',  'turquoise', 3),
    ('ab100000-0000-4000-8000-000000000005', 'ab000000-0000-4000-8000-000000000001', 'Closed',     'slate',     4),
    ('ac100000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000001', 'Watching',   'slate',     0),
    ('ac100000-0000-4000-8000-000000000002', 'ac000000-0000-4000-8000-000000000001', 'Open now',   'amber',     1),
    ('ac100000-0000-4000-8000-000000000003', 'ac000000-0000-4000-8000-000000000001', 'Applying',   'purple',    2),
    ('ac100000-0000-4000-8000-000000000004', 'ac000000-0000-4000-8000-000000000001', 'Submitted',  'turquoise', 3),
    ('ac100000-0000-4000-8000-000000000005', 'ac000000-0000-4000-8000-000000000001', 'Closed',     'slate',     4)
  on conflict (id) do update
    set board_id = excluded.board_id, name = excluded.name,
        colour = excluded.colour, position = excluded.position;

  -- ---------------------------------------------------------------------------
  -- Awards cards
  -- Label key: pink = NI, turquoise = UK, purple = Ireland / all-island,
  --            red = deadline inside 30 days.
  -- ---------------------------------------------------------------------------
  insert into public.board_cards
    (id, board_id, list_id, title, org, kind, amount, due_date, status, remind_days, labels, url, notes, position)
  values
    -- Open now
    ('ab200000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000002',
     'AIB Business Eye Awards 2026', 'Business Eye', 'competition', 0, '2026-09-25', 'eligible', 10,
     '{pink,red}', 'https://www.businesseyeawards.co.uk/',
     'NI''s main business awards, 20th year. Deadline 25 Sep 2026, gala 22 Oct 2026 at ICC Belfast. 20 categories; the ones that fit are Small Business of the Year, Innovative Company of the Year, Fast Growth Business, Business Personality of the Year, Diversity & Inclusion. Confirm entry fee on the entry form.', 0),

    ('ab200000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000002',
     'Startups 100 Index 2027', 'Startups.co.uk', 'competition', 0, '2026-10-02', 'eligible', 10,
     '{turquoise,red}', 'https://startups.co.uk/news/apply-to-the-startups-100-2027/',
     'Free to enter, closes 5pm Fri 2 Oct 2026. Eligibility: UK HQ, Companies House registered, founded on or after 1 Jan 2021. ClickClick (NI707611, inc. Jan 2024) clears all three. Best profile-per-hour on this board.', 1),

    ('ab200000-0000-4000-8000-000000000003', 'ab000000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000002',
     'Technology Ireland Industry Awards 2026', 'Ibec / Technology Ireland', 'competition', 0, '2026-10-06', 'check', 10,
     '{purple,red}', 'https://www.ibec.ie/technologyireland/industry-awards/how-to-enter',
     'Free to enter, deadline extended to 23:59 Mon 6 Oct 2026, gala 20 Nov 2026 Mansion House Dublin. 34th year, 11 categories, open to Ibec members and non-members. CHECK: billed as "Irish-based software and digital technology companies" — confirm with awards@technology-ireland.ie that a NI-registered company qualifies before writing.', 2),

    ('ab200000-0000-4000-8000-000000000004', 'ab000000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000002',
     'Global Business Tech Awards 2027', 'Business Tech Awards', 'competition', 0, '2026-11-05', 'check', 14,
     '{turquoise}', 'https://globalbusinesstechawards.com/',
     'Three tiers: super early bird 5 Nov 2026, early bird 26 Nov 2026, final deadline 10 Dec 2026. Aimed at early-stage and high-growth businesses using tech. Paid entry — price rises at each tier, so decide before 5 Nov.', 3),

    -- Watching
    ('ab200000-0000-4000-8000-000000000010', 'ab000000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000001',
     'Women in Business NI Awards 2027', 'Women in Business NI', 'competition', 0, '2027-01-19', 'eligible', 30,
     '{pink}', 'https://www.womeninbusinessni.com/',
     'ESTIMATED DATE. The 2026 round closed 12 noon 19 Jan 2026 with the gala on 12 Mar 2026, so expect entries to open around Dec 2026 and close mid-Jan 2027. 11 categories including Growth & Scaling Business of the Year. Strongest cultural fit on the board.', 0),

    ('ab200000-0000-4000-8000-000000000011', 'ab000000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000001',
     'Belfast Telegraph Business Awards 2027', 'Belfast Telegraph', 'competition', 0, '2027-02-05', 'eligible', 21,
     '{pink}', 'https://www.northernirelandchamber.com/member-news/entries-open-for-belfast-telegraph-business-awards-2026/',
     'ESTIMATED DATE. The 2026 round closed 5pm Fri 6 Feb 2026, so entries should open around Nov/Dec 2026. Confirm on the Belfast Telegraph awards site once launched.', 1),

    ('ab200000-0000-4000-8000-000000000012', 'ab000000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000001',
     'InterTradeIreland Seedcorn 2027', 'InterTradeIreland', 'competition', 100000, '2027-04-23', 'eligible', 45,
     '{purple}', 'https://intertradeireland.com/funding/seedcorn',
     'ESTIMATED DATE. All-island competition, explicitly open to NI companies. The 2026 round closed 1pm Fri 24 Apr 2026, so expect a Jan/Feb 2027 launch and a late-April 2027 deadline. Prize fund EUR 800k total: EUR 50k per regional winner, EUR 100k per category winner (B2B / B2C / Deeptech). Investor-readiness feedback is worth as much as the cash. Enter B2B.', 2),

    ('ab200000-0000-4000-8000-000000000013', 'ab000000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000001',
     'Irish News Business Excellence Awards 2027', 'The Irish News', 'competition', 0, '2027-04-01', 'eligible', 30,
     '{purple}', 'https://bea.irishnews.com/',
     'ESTIMATED DATE. Free to enter and open to businesses anywhere on the island of Ireland. Ceremony confirmed for Thu 3 Jun 2027, entries usually open in the new year. Watch bea.irishnews.com from Jan 2027.', 3),

    ('ab200000-0000-4000-8000-000000000014', 'ab000000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000001',
     'The Small Awards 2027', 'Small Business Britain', 'competition', 0, '2027-03-01', 'check', 21,
     '{turquoise}', 'https://thesmallawards.uk/',
     'Entries close midnight 1 Mar 2027. Judged on business performance plus evidence of community engagement, which suits a story-led entry more than a metrics-led one.', 4),

    ('ab200000-0000-4000-8000-000000000015', 'ab000000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000001',
     'Great British Entrepreneur Awards 2027', 'GBEA / Allica Bank', 'competition', 0, '2027-03-15', 'eligible', 30,
     '{turquoise}', 'https://greatbritishentrepreneurawards.com/',
     'ESTIMATED DATE. The 2026 round is closed. Entries open each March, so join the waitlist now and diarise a March 2027 check. Regional NI heats feed the national final.', 5),

    ('ab200000-0000-4000-8000-000000000016', 'ab000000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000001',
     'Lloyds British Business Excellence Awards 2027', 'Lloyds / BBEA', 'competition', 0, '2027-06-18', 'check', 30,
     '{turquoise}', 'https://britishbusinessexcellenceawards.co.uk/',
     'ESTIMATED DATE. The 2026 round: early bird entry GBP 299 until 30 Apr, final deadline 19 Jun 2026, ceremony 10 Nov 2026. Paid entry and a crowded national field, so only worth it if a category lines up exactly.', 6),

    ('ab200000-0000-4000-8000-000000000017', 'ab000000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000001',
     'Belfast Chamber Business Awards 2027', 'Belfast Chamber', 'competition', 0, '2027-08-27', 'eligible', 30,
     '{pink}', 'https://belfastchamber.com/awards/',
     'ESTIMATED DATE. Free to enter, members and non-members, for businesses based in or trading in Belfast. The 2026 round closed Fri 28 Aug 2026 with the gala on 16 Oct 2026. 18 categories including Best New Business. Registered address is Arthur House, Belfast, so eligibility is clean.', 7),

    ('ab200000-0000-4000-8000-000000000018', 'ab000000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000001',
     'UK Business Tech Awards 2027', 'Business Tech Awards', 'competition', 0, '2027-03-25', 'check', 21,
     '{turquoise}', 'https://businesstechawards.com/',
     'ESTIMATED DATE. The 2026 cycle ran super early bird 26 Mar, early bird 16 Apr, extended 7 May, ceremony 8 Jul 2026. Expect the same shape in 2027. Sister programme to the Global Business Tech Awards; pick one, not both.', 8),

    ('ab200000-0000-4000-8000-000000000019', 'ab000000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000001',
     'King''s Awards for Enterprise 2028', 'Department for Business & Trade', 'competition', 0, '2027-09-07', 'check', 45,
     '{turquoise}', 'https://www.gov.uk/kings-awards-for-enterprise',
     'ESTIMATED DATE. The 2027 round closed 1pm Tue 8 Sep 2026 — missed by two days, no realistic way to enter now. Categories: Innovation, International Trade, Sustainable Development, Promoting Opportunity, plus the new Young Founder award (18-30). Requires at least 2 full-time UK employees and a track record (Innovation needs 2 years of commercial success, International Trade 3 years of overseas earnings). Build toward the Sep 2027 window.', 9),

    ('ab200000-0000-4000-8000-000000000020', 'ab000000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000001',
     'National Startup Awards (Ireland)', 'National Startup Awards', 'competition', 0, '2026-10-13', 'check', 14,
     '{purple}', 'https://startupawards.ie/',
     'ESTIMATED DATE, based on the prior cycle closing 13 Oct with a November ceremony in Dublin. Open to businesses five years old or younger. CHECK: the site does not state whether NI companies qualify — email before writing anything.', 10),

    ('ab200000-0000-4000-8000-000000000021', 'ab000000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000001',
     'SFA National Small Business Awards 2027', 'SFA / Ibec', 'competition', 0, null, 'blocked', 30,
     '{purple}', 'https://www.ibec.ie/sfa/sfa-awards',
     'Dates for the 2027 edition not yet published. Open to businesses with 50 employees or fewer "in Ireland" — the SFA is a Republic of Ireland body, so a NI-registered company is very likely out. Left as blocked until someone confirms otherwise.', 11),

    ('ab200000-0000-4000-8000-000000000022', 'ab000000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000001',
     'Stevie Awards for Women in Business 2027', 'Stevie Awards', 'competition', 0, '2027-08-11', 'check', 30,
     '{turquoise}', 'https://stevieawards.com/women',
     'ESTIMATED DATE. International, paid entry per category, 2026 final deadline was extended to 3 Sep 2026. Reputable but pay-to-enter and US-centric; treat as a stretch, not a priority.', 12)
  on conflict (id) do update
    set board_id = excluded.board_id, list_id = excluded.list_id, title = excluded.title,
        org = excluded.org, kind = excluded.kind, amount = excluded.amount,
        due_date = excluded.due_date, status = excluded.status, remind_days = excluded.remind_days,
        labels = excluded.labels, url = excluded.url, notes = excluded.notes, position = excluded.position;

  -- ---------------------------------------------------------------------------
  -- Accelerator cards
  -- ---------------------------------------------------------------------------
  insert into public.board_cards
    (id, board_id, list_id, title, org, kind, amount, due_date, status, remind_days, labels, url, notes, position)
  values
    -- Open now
    ('ac200000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000001', 'ac100000-0000-4000-8000-000000000002',
     'Antler UK — March 2027 residency', 'Antler', 'support', 500000, '2026-09-30', 'check', 10,
     '{turquoise,red}', 'https://www.antler.co/location/uk',
     'Applications close 30 Sep 2026 for the residency starting 10 Mar 2027. Eight-week sprint in London, up to GBP 500k at inception/pre-seed. CHECK: Antler is built around forming new teams and expects you in London for the sprint — a poor fit for an already-trading NI company unless they take solo founders with a live product. Ask before spending time on it.', 0),

    ('ac200000-0000-4000-8000-000000000002', 'ac000000-0000-4000-8000-000000000001', 'ac100000-0000-4000-8000-000000000002',
     'Y Combinator — Winter 2027 batch', 'Y Combinator', 'support', 500000, '2026-11-02', 'check', 21,
     '{turquoise}', 'https://www.ycombinator.com/apply',
     'On-time deadline 2 Nov 2026, 8pm PT; decisions by 11 Dec; batch runs Jan-Mar 2027 in San Francisco. USD 500k standard deal. Requires being in SF for the batch. Long odds (~1%) but the application itself is free and forces a sharp pitch.', 1),

    ('ac200000-0000-4000-8000-000000000003', 'ac000000-0000-4000-8000-000000000001', 'ac100000-0000-4000-8000-000000000002',
     'Techstars London — Spring 2027', 'Techstars', 'support', 220000, '2026-11-18', 'check', 21,
     '{turquoise}', 'https://www.techstars.com/accelerators/london',
     'Applications opened 24 Aug 2026 and close 18 Nov 2026. Programme starts 8 Mar 2027, demo day 3 Jun 2027. USD 220k investment for equity, 13 weeks mentor-driven in London. Apply early: late applications drop into a general pool.', 2),

    ('ac200000-0000-4000-8000-000000000004', 'ac000000-0000-4000-8000-000000000001', 'ac100000-0000-4000-8000-000000000002',
     'NDRC Accelerator (Dogpatch Labs)', 'NDRC / Dogpatch Labs', 'support', 100000, null, 'check', 30,
     '{purple}', 'https://www.ndrc.ie/accelerator',
     'Always-on: rolling applications, no cohort deadline. EUR 100k on an uncapped founder-friendly SAFE, three core weeks on site at Dogpatch Labs in Dublin. CHECK: NDRC is Enterprise Ireland funded, which usually means Republic of Ireland companies only — confirm NI eligibility first. No deadline pressure, so ask the question before writing.', 3),

    ('ac200000-0000-4000-8000-000000000005', 'ac000000-0000-4000-8000-000000000001', 'ac100000-0000-4000-8000-000000000002',
     'Entrepreneur First — London', 'Entrepreneur First', 'support', 250000, null, 'check', 30,
     '{turquoise}', 'https://www.joinef.com/',
     'Rolling applications, USD 250k at pre-seed with up to USD 5m follow-on, roughly six months to demo day. Like Antler, EF is oriented toward forming new teams rather than backing an existing trading company — verify fit before applying.', 4),

    -- Watching
    ('ac200000-0000-4000-8000-000000000010', 'ac000000-0000-4000-8000-000000000001', 'ac100000-0000-4000-8000-000000000001',
     'Barclays Eagle Labs Female Founder Accelerator 2027', 'Barclays Eagle Labs / AccelerateHER', 'support', 0, '2027-06-11', 'eligible', 30,
     '{turquoise}', 'https://labs.uk.barclays/what-we-offer/our-programmes/female-founder-accelerator/',
     'ESTIMATED DATE. Free, nine weeks, up to 100 UK female founders scaling tech businesses; masterclasses plus 1:1 mentoring. The 2026 round closed 12 Jun 2026 and ran from Sep 2026. Requires an MVP or near-MVP with user feedback, which ClickClick Live clears. No equity, no cost — the highest value-per-risk item on this board.', 0),

    ('ac200000-0000-4000-8000-000000000011', 'ac000000-0000-4000-8000-000000000001', 'ac100000-0000-4000-8000-000000000001',
     'Catalyst INVENT 2027', 'Catalyst (NI)', 'competition', 50000, '2027-03-01', 'eligible', 30,
     '{pink}', 'https://wearecatalyst.org/programmes/invent/',
     'ESTIMATED DATE. Currently closed, register interest on the Catalyst site. NI-only innovation competition with a GBP 50k prize fund, headline partner Bank of Ireland; historically opens in the new year and runs to a June final. Comes with pitch coaching whether or not you win.', 1),

    ('ac200000-0000-4000-8000-000000000012', 'ac000000-0000-4000-8000-000000000001', 'ac100000-0000-4000-8000-000000000001',
     'Catalyst Springboard / Co-Founders', 'Catalyst (NI)', 'support', 0, null, 'check', 30,
     '{pink}', 'https://wearecatalyst.org/programmes/',
     'Springboard is the Catalyst programme for products already in market or generating revenue, which is where ClickClick Live sits. Co-Founders is earlier stage. No dates published online — ring 028 9073 7800 or email enquiries@WeAreCatalyst.org for the next intake.', 2),

    ('ac200000-0000-4000-8000-000000000013', 'ac000000-0000-4000-8000-000000000001', 'ac100000-0000-4000-8000-000000000001',
     'Propel Pre-Accelerator', 'Invest NI / Ignite', 'support', 15000, null, 'check', 30,
     '{pink}', 'https://www.nibusinessinfo.co.uk/content/propel-pre-accelerator-programme',
     'Six-month Invest NI pre-accelerator for early-stage NI tech startups: GBP 15k grant, 12 months free desk space at Ormeau Baths, mentor network. CHECK TWO THINGS: (1) whether the current intake is open, (2) whether being an Invest NI client already on Ambition to Grow rules it out or double-counts. Ask the Client Executive rather than guessing.', 3),

    ('ac200000-0000-4000-8000-000000000014', 'ac000000-0000-4000-8000-000000000001', 'ac100000-0000-4000-8000-000000000001',
     'Innovate UK Women in Innovation Awards 2026/27', 'Innovate UK / UKRI', 'grant', 75000, null, 'check', 30,
     '{turquoise}', 'https://iuk-business-connect.org.uk/programme/women-in-innovation/',
     'GBP 75k grant plus bespoke business support for women founders of UK-registered businesses at late startup stage. The 2025/26 round ran 26 Nov 2025 to 4 Feb 2026 and is closed. Reporting suggests the next cycle moves to weekly stage-1 submissions with four stage-2 deadlines across 2026/27 — check the Innovation Funding Service directly, third-party blogs on Innovate UK are routinely out of date.', 4),

    ('ac200000-0000-4000-8000-000000000015', 'ac000000-0000-4000-8000-000000000001', 'ac100000-0000-4000-8000-000000000001',
     'AccelerateHER Women to Women (cohort 5)', 'AccelerateHER', 'support', 0, null, 'eligible', 30,
     '{turquoise}', 'https://accelerateher.co.uk/women-to-women/',
     'Free peer/mentoring programme for female founders; cohort 4 opened Jun 2026. Watch for the cohort 5 call. Lower intensity than the Eagle Labs accelerator and the two run from the same network, so treat as a fallback.', 5),

    ('ac200000-0000-4000-8000-000000000016', 'ac000000-0000-4000-8000-000000000001', 'ac100000-0000-4000-8000-000000000001',
     'Forward Faster (FFinc)', 'FFinc', 'support', 0, '2026-09-18', 'blocked', 14,
     '{turquoise}', 'https://www.events.ffinc.co/apply-forward-faster',
     'Six-month growth programme for female-founded UK businesses, applications close 18 Sep 2026. BLOCKED: entry requires GBP 500k+ annual revenue. Revisit when turnover supports it.', 6)
  on conflict (id) do update
    set board_id = excluded.board_id, list_id = excluded.list_id, title = excluded.title,
        org = excluded.org, kind = excluded.kind, amount = excluded.amount,
        due_date = excluded.due_date, status = excluded.status, remind_days = excluded.remind_days,
        labels = excluded.labels, url = excluded.url, notes = excluded.notes, position = excluded.position;
end $$;

-- What landed
select b.name as board, l.name as list, count(c.id) as cards
from public.boards b
join public.board_lists l on l.board_id = b.id
left join public.board_cards c on c.list_id = l.id
where b.id in ('ab000000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000001')
group by b.name, b.position, l.name, l.position
order by b.position, l.position;
