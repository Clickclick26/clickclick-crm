-- ClickClick CRM — "Trade missions & export" board.
--
-- Researched 6 Sep 2026. Same shape as the earlier board import: ids are
-- uuid5-derived from stable keys, so re-running this UPDATES the board in
-- place rather than duplicating it. Safe to run as many times as you like.
--
-- Run in the Supabase SQL editor for project gapybapywpdogexibtgj.

do $$
declare
  v_owner uuid;
  v_board uuid := 'fa085507-9d83-58b1-80c8-6400633d2888';
begin
  -- agents has no email column; the address lives on auth.users.
  select a.id into v_owner
  from public.agents a
  join auth.users u on u.id = a.id
  where lower(u.email) = 'kathryn@clickclick.video';

  if v_owner is null then
    raise exception 'No agent found for kathryn@clickclick.video. Check auth.users, or hard-code the agent id.';
  end if;

  insert into public.boards (id, owner_id, name, accent, shared, position)
  values (
    v_board, v_owner, 'Trade missions & export', 'pink', false,
    coalesce((select max(position) + 1 from public.boards where owner_id = v_owner), 0)
  )
  on conflict (id) do update
    set name = excluded.name, accent = excluded.accent;

  insert into public.board_lists (id, board_id, name, colour, position) values
    ('1c299de7-a666-5b8d-aff4-ff2008cc768b', v_board, 'Apply now', 'red', 0),
    ('3cf8b796-6fe5-5bb2-9894-811250628494', v_board, 'Watching', 'amber', 10),
    ('b0f72cf5-e463-5b9a-be63-b997e9d14946', v_board, 'Applied', 'turquoise', 20),
    ('bd3940a5-671d-5f52-a380-62bbc11c1eef', v_board, 'Going', 'purple', 30),
    ('c198ff49-97b0-5a34-8129-5ae88ff829e1', v_board, 'Not a fit / missed', 'slate', 40)
  on conflict (id) do update
    set name = excluded.name, colour = excluded.colour, position = excluded.position;

  insert into public.board_cards
    (id, board_id, list_id, title, org, kind, amount, due_date, status, remind_days, labels, url, notes, position) values
    ('2a9888ac-8c9d-5006-a065-df0da0aab1fb', v_board, '1c299de7-a666-5b8d-aff4-ff2008cc768b', 'Ask Invest NI Client Executive for the trade mission pipeline', 'Invest NI', 'task', 0, '2026-09-09'::date, 'eligible', 2, '{turquoise}'::text[], 'https://www.investni.com/support-for-business/exhibitions-and-trade-missions', 'Highest-leverage action on this board. Mission support is Invest NI client-only and you are a client (Ambition to Grow, Supporting Women), so you have a Client Executive. Ask for: the full 2026/27 outward mission pipeline for tech and digital, which ones take non-exporters, and to be flagged for tech missions before they hit the public calendar. The public calendar only shows a handful of events and misses sector missions that fill from the client list. Also ask exportevents@investni.com / 0800 181 4422.', 0),
    ('f5ced3ec-f59b-5bb8-bad9-42214c94a318', v_board, '1c299de7-a666-5b8d-aff4-ff2008cc768b', 'Technology Trade Mission: Ottawa and Toronto', 'Invest NI', 'support', 600, '2026-09-11'::date, 'eligible', 2, '{turquoise,red}'::text[], 'https://www.investni.com/support-for-business/exhibitions-trade-missions/technology-trade-mission', 'BEST FIT ON THE BOARD. 5 to 9 Oct 2026, Ottawa and Toronto. Sectors named: AI, cloud, cybersecurity, GovTech, data and digital. Ottawa is Kanata North (Canada largest tech hub, SaaS heavy), Toronto is MaRS for startups and scale-ups. Eligibility: NI-based, product sellable outside NI, existing Invest NI client. All three are yes. Cost: 500 GBP + VAT participation fee, plus grant assistance up to 600 GBP per person for up to 2 employees toward travel and accommodation (paid on completing the evaluation questionnaire). NO PUBLISHED DEADLINE: places are allocated first come, first served and the mission is four weeks out, so this is effectively closing now. Apply via the online form on the page, or ring 0800 181 4422.', 10),
    ('d01064fa-dbcf-5116-aee7-97cda832dc72', v_board, '1c299de7-a666-5b8d-aff4-ff2008cc768b', 'Digital, Immersive and Retail Tech Mission to NRF 2027', 'Dept for Business and Trade', 'support', 0, '2026-09-30'::date, 'check', 3, '{purple,red}'::text[], 'https://www.events.great.gov.uk/website/19842/', 'Perfect sector fit, hard eligibility bar. NRF Big Show, New York, 9 to 12 Jan 2027. Aimed at UK retail tech, digital commerce and immersive tech: exactly the live-commerce and video-commerce buyer set. UK Pavilion pod, 2 exhibition tickets, pre-mission briefing, listing in show brochures, VIP reception with US retail C-suite. Cost 6,000 GBP + VAT, travel/accommodation/visa/shipping on top. Applications close Wed 30 Sep 2026, 5pm. Invitations issued w/c 5 Oct, commitment fee due 31 Oct 2026. ELIGIBILITY RISK: the published criteria include a minimum 2m GBP revenue, plus already exporting to at least one market and past MVP/early beta. The revenue bar is the blocker. Worth emailing richard.hall@businessandtrade.gov.uk to ask whether the revenue floor is firm for an NI software company, before writing it off. Invited-only and space-limited, so an early ask is cheap.', 20),
    ('d3b9380e-e660-5ed1-a2c7-26dca3ee9cb6', v_board, '3cf8b796-6fe5-5bb2-9894-811250628494', 'Check the Invest NI International Trade Calendar', 'Invest NI', 'task', 0, '2026-10-05'::date, 'eligible', 3, '{turquoise}'::text[], 'https://www.investni.com/node/17761', 'Standing monthly check. As of 6 Sep 2026 the published calendar is Canada tech mission (5 to 9 Oct 2026), FDEA Meet the Buyer London (14 to 15 Oct), EuroTier Hanover (10 to 13 Nov), ReBuild Ukraine Warsaw (12 to 13 Nov), Photonics West San Francisco (2 to 4 Feb 2027), Vin Paris (15 to 17 Feb 2027), AGG1 New Orleans (15 to 17 Mar 2027), Aircraft Interiors Hamburg (6 to 8 Apr 2027), Paris Air Show (14 to 20 Jun 2027). Only the Canada one is a tech mission. Calendar is explicitly subject to change and new tech missions get added, so re-check monthly.', 0),
    ('9d24d8e5-74ec-534d-9dc2-e5ba06ec1788', v_board, '3cf8b796-6fe5-5bb2-9894-811250628494', 'Council ROI Trade Programme and European mission, autumn 2026', 'NI councils / LEP', 'support', 0, '2026-09-18'::date, 'check', 5, '{amber}'::text[], 'https://www.northernirelandchamber.com/member-news/lisburn-and-castlereagh-city-council-to-lead-business-and-investment-mission-in-london/', 'An ROI Trade Programme and a European trade mission are both planned for autumn 2026, part funded through the Local Economic Partnership and run by councils rather than Invest NI. Council missions usually have no client-status or revenue test, which makes them a far softer entry than the DBT missions. ACTION: ring Belfast City Council economic development and ask which council is running these, whether a Belfast-registered software firm can join, and when recruitment opens. Registered address is Arthur House, Belfast BT1 4GB, so Belfast City Council is the home council.', 10),
    ('abac0d85-e1f8-5c45-9b2b-8afcb6998439', v_board, '3cf8b796-6fe5-5bb2-9894-811250628494', 'Belfast Chamber New York trade mission 2027', 'Belfast Chamber', 'support', 0, '2027-03-01'::date, 'check', 14, '{amber}'::text[], 'https://belfastchamber.com/belfast-chamber-strengthens-us-business-links-through-new-york-trade-mission/', 'Runs annually. The 2026 edition took 30-plus NI businesses to New York from 16 Jun 2026, with a Belfast City Council and NI Bureau reception and an Invest NI networking breakfast. Cross-sector rather than tech-only, membership-based, no revenue floor. Recruitment for a June mission typically opens in spring. ACTION: ask Belfast Chamber to put you on the notification list for the 2027 mission now, and check what membership costs.', 20),
    ('f6a53058-e30a-51a7-99d3-c944d93d853d', v_board, '3cf8b796-6fe5-5bb2-9894-811250628494', 'Subscribe to the techUK Market Access Brief', 'techUK', 'task', 0, '2026-09-09'::date, 'eligible', 2, '{turquoise}'::text[], 'https://www.techuk.org/market-access-programme.html', 'Fortnightly round-up of DBT and techUK missions, UK Pavilions and delegations for tech companies. It is where the NRF mission and the GITEX pavilion were listed with their deadlines. Free to read, and the single best early-warning feed for UK-wide tech missions. Subscribing costs nothing and removes the need to hunt for deadlines by hand.', 30),
    ('59fe28eb-08e1-5e5c-90e7-bc18e33bfa44', v_board, '3cf8b796-6fe5-5bb2-9894-811250628494', 'WeGrow and Women in Business NI export routes', 'InterTradeIreland', 'support', 0, '2026-09-25'::date, 'check', 7, '{pink}'::text[], 'https://intertradeireland.com/news/women-entrepreneurs-invited-to-join-new-programmes-driving-growth-innovation-and-scale-across-the-island', 'WeGrow is the all-island programme for women entrepreneurs, led by InterTradeIreland with Invest NI and Enterprise Ireland, delivered with Women in Business NI and Network Ireland. Started early 2026, mentoring and workshops rather than a mission, but it is the feeder into the women-led delegations. Separately, a women-led NI and ROI investment mission has run to Boston and New York with British and Irish consulate briefings and VC meetings. ACTION: ask Women in Business NI when the next US delegation recruits and what the entry criteria are. You are already on Ambition to Grow Supporting Women, so the profile matches.', 40),
    ('ec59bd65-1fcb-5aad-812b-e843abab0e78', v_board, 'c198ff49-97b0-5a34-8129-5ae88ff829e1', 'GITEX Global 2026 Dubai UK Pavilion: deadline passed', 'techUK / DBT', 'support', 0, '2027-08-01'::date, 'blocked', 14, '{slate}'::text[], 'https://www.techuk.org/what-we-deliver/events/join-the-techuk-delegation-and-uk-pavilion-at-gitex-global-2026-dubai.html', 'GITEX Global runs 7 to 11 Dec 2026 in Dubai. The UK Pavilion had 20 pods, first come first served, and pod booking closed 1 Sep 2026, five days before this board was built. Missed for 2026. Package was 3 exhibitor passes, 10 free visitor codes, a speaking slot on the UK Pavilion stage, UK Directory listing and DBT networking receptions. Due date on this card is a reminder to book the 2027 pavilion in August 2027, not a live deadline.', 0),
    ('68f37f56-53cf-581c-86ca-9cb61e154756', v_board, 'c198ff49-97b0-5a34-8129-5ae88ff829e1', 'Rest of the Invest NI calendar: wrong sectors', 'Invest NI', 'support', 0, null, 'blocked', 30, '{slate}'::text[], 'https://www.investni.com/node/17761', 'Logged so they are not re-researched every month. EuroTier (agri-tech), ReBuild Ukraine (construction), Photonics West (advanced manufacturing), Vin Paris and FDEA Meet the Buyer (food and drink), AGG1 (materials handling), Aircraft Interiors and Paris Air Show (aerospace and defence). None sell video marketing or live-commerce software. The Singapore technology mission on the Invest NI site is a past event from Nov 2024, not an open one.', 10)
  on conflict (id) do update set
    list_id     = excluded.list_id,
    title       = excluded.title,
    org         = excluded.org,
    kind        = excluded.kind,
    amount      = excluded.amount,
    due_date    = excluded.due_date,
    status      = excluded.status,
    remind_days = excluded.remind_days,
    labels      = excluded.labels,
    url         = excluded.url,
    notes       = excluded.notes,
    position    = excluded.position;
end $$;
