# ClickClick CRM — handoff for Claude (backend)

**Read this before writing any backend code.**

The frontend UI is intentional and approved. Do **not** redesign it.

> **Cursor note (2026-08-04):** CSV upload + follow-up reminders were added while Kathryn was out of Claude credits.  
> See **`docs/cursor-handoff-2026-08-04-csv-reminders/README.md`** — review, merge with any of your other changes, then commit when she asks. Not committed yet on purpose.

---

## Hard rules (do not break)

1. **Do not change visual design** unless Kathryn explicitly asks.
   - Leave alone: `src/index.css`, layout structure in `src/App.tsx`, logo usage, colours, radii, spacing, Poppins.
2. **Do not rename or restyle** bubble cards, pills, sidebar, or “Close deal” / “Calling from” patterns.
3. Put integrations in **`src/lib/`** (new folder). Wire UI through small hooks/adapters.
4. Prefer **replacing mock data** behind the same screens over building new screens.
5. Host later at **`crm.clickclick.video`** (subdomain of clickclick.video).
6. Phone provider: **Telnyx** (cheaper). Not Twilio unless blocked.
7. Talk simply in PRs/docs when writing for Kathryn.

---

## What this product is

**ClickClick CRM** + **ClickClick Dialer** — call-centre desk for ClickClick brands (ClickClick + CLocal to start).

Stack today:
- Vite + React + TypeScript
- Single app shell: `src/App.tsx`
- Mock data: `src/data/mock.ts`
- Brand assets: `public/brand/`

Run:
```bash
cd /Users/kathryn/Projects/clickclick-crm
npm install
npm run dev
```

---

## Brand (locked)

From clickclick.video:

| Token | Value |
|-------|--------|
| Font | Poppins |
| Cream / bg | `#F0EAD6` / soft cream gradients |
| Turquoise | `#00bcd4` |
| Purple | `#7b5ea7` |
| Pink (alerts, missed, accents) | `#e83e8c` — **not red** |
| Dark | `#141414` |
| Top-left logo | stacked: `clickclick-logo-stacked-black.png` |
| Sidebar mark | horizontal logo (inverted) |
| UI feel | soft **bubble** cards, big radius, minimal text |

Header: stacked logo + pink **CRM** chip only. No long “ClickClick Dialer · call centre desk” titles.

---

## Screens / nav

Left icon nav:

| Id | Purpose |
|----|---------|
| dialer / recents | Call desk (main) |
| contacts | People list |
| pipeline | Kanban board |
| lists | Dialer lists |
| reports | Today’s numbers |
| settings (gear) | Admin: scripts, contracts, connect |

When dialer/recents/contacts: 3 columns (sidebar + list + main).  
When pipeline/lists/reports/settings: main gets `.wide` (spans empty list column).

---

## Feature inventory (all must survive backend)

### Softphone / dialer
- Call / End, mute
- **Channel picker:** Phone dialer (Telnyx) **or Lark video** (Lark VC live meeting)
- Lark video: start meeting → guest link → email via Lark; easy when client wants face-to-face
- Phone: Telnyx numbers + auto/manual from-number
- **Every connected call is always recorded** (phone + enable Lark meeting record when available)
- Admin **Listen live (silent)** on phone legs: admin hears; agent cannot hear admin
- Call outcomes, DNC, quiet hours, consent line

### Call coaching / replay
- Admin can **replay** any saved recording later
- UI shows **salesperson name**, **customer name**, company, when
- Admin writes **feedback** → saved to that salesperson’s **coaching file** (with customer name on the note)
- Admin → Settings → **Coaching** tab lists files per agent
- Agents should later be able to read their own coaching file (MVP: admin writes; agent read optional)

### Calling from (caller ID)
- Show outbound number on screen
- **Auto · best local**: match lead `region` → brand local number → else agent personal → else brand main
- **Manual pick**: agent’s own number + brand local/main lines
- Every salesperson has **personalNumberId**
- Brand lines for ClickClick + CLocal (Belfast/NI, London, Scotland, Wales)
- See `pickBestOutboundNumber` in `src/data/mock.ts`

### Scripts + objections
- Script panel with `{{name}}` `{{agent}}` `{{company}}`
- Objection buttons swap reply text
- **Admin → Scripts**: edit for Everyone (bulk) or one agent; Apply to all
- Dialer uses agent override if present, else default

### Warm-up / brochure
- On dialer: **Warm-up pack** card — pick brand (ClickClick / CLocal) → one-tap **Brochure**, **Info kit**, or brand-specific packs
- Sends via Lark Mail (fills email composer + send mock)
- For generic “warming them up about ClickClick” calls before a hard pitch
- Admin later: upload PDF assets per kit in storage; link in email

### Notes + contact facts
- Notes editable on screen
- Email, timezone, owner, tags, area/region, stage, source, callback

### Pipeline
- Stages: `new` → `talking` → `proposal` → `won` → `lost`
- Board + move arrows + stage pills
- Same stage pills on dialer contact card
- Contacts live in React state today (`contacts`) — persist to DB

### Close deal (payments + contracts + commission)
- Brand: ClickClick / CLocal
- Package ticks (auto-fill prices)
- Pay types:
  - **one_off** — Stripe
  - **deposit** — Stripe deposit
  - **monthly** — Stripe subscription
  - **direct_debit** — GoCardless (UK)
- Fields: client name, company, start/end, total, deposit, monthly, extra contract text
- Actions (mocked today):
  - Generate & send contract (Lark email + e-sign link → signed PDF to secure storage)
  - Send Stripe / DD pay link
- **No “commission” wording / no “That’s a win” button.** Hitting **Send Stripe pay link** (or Direct Debit) fires **confetti**. When payment clears (webhook), auto-credit the agent quietly (“on your board” toast).

### Admin → Contracts
- Templates per brand + pay type
- Editable body with merge tags: `{{client_name}}` `{{company}}` `{{packages}}` `{{total_price}}` `{{deposit_amount}}` `{{monthly_amount}}` `{{start_date}}` `{{end_date}}` `{{brand}}`
- Save / revert

### Lark
- Email composer stub + Share to Lark chat stub
- Contracts / pay links should send via Lark Mail when real

### Reports / lists
- Stats cards + dialer lists (mock counts)

---

## Suggested backend architecture

```
src/
  App.tsx              # UI shell — keep look; thin wiring only
  index.css            # DO NOT restyle casually
  data/mock.ts         # types + seed; shrink as APIs land
  lib/
    phone/             # Telnyx: dial, record, webhooks, from-number
    crm/               # contacts, notes, pipeline, lists
    deals/             # packages, pay type, commission
    contracts/         # templates, generate PDF, e-sign, storage
    payments/          # Stripe + GoCardless
    lark/              # mail + chat
    auth/              # agents, roles (admin vs agent)
```

### Recommended services
| Need | Service |
|------|---------|
| DB + auth + file storage | **Supabase** (Postgres + Storage private bucket for signed PDFs) |
| Voice | **Telnyx** |
| Card / sub / deposit | **Stripe** (Payment Links or Checkout + Customer Portal as needed) |
| UK Direct Debit | **GoCardless** |
| E-sign | Dropbox Sign / PandaDoc / Documenso (pick one; return signed PDF to Storage) |
| Email/chat | **Lark Open API** |

### Env (example — do not commit secrets)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
TELNYX_API_KEY=
TELNYX_PUBLIC_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
GOCARDLESS_ACCESS_TOKEN=
LARK_APP_ID=
LARK_APP_SECRET=
ESIGN_API_KEY=
```
Use server routes or Supabase Edge Functions for secrets — never expose Telnyx/Stripe secret keys in the Vite client.

---

## Data model sketch

Keep field names close to `src/data/mock.ts` types.

- **agents** — id, name, role, personal_number_id, online
- **outbound_numbers** — id, label, e164, brand_id, region, kind (personal|local|main), agent_id?
- **contacts** — + region, stage, owner_id, dnc, quiet_hours, notes, tags, source
- **calls** — contact_id, from_number_id, status, outcome, recording_url (always for connected), agent_id, duration
- **call_feedback** — call_id, agent_id, contact_name, company, admin_id, note, created_at (coaching file)
- **scripts** — scope everyone|agent_id, title, body
- **objections** — label, reply (optional per brand later)
- **packages** — brand_id, name, prices
- **contract_templates** — brand_id, pay_type, name, body
- **deals** — contact_id, brand_id, package_ids[], pay_type, amounts, dates, status, agent_id, signed_pdf_path, stripe/gocardless ids
- **commission_events** — deal_id, agent_id, amount_basis, rule, status

---

## UX flows Claude must preserve

### Outbound call
1. Open contact → see **Calling from** (auto or manual)  
2. Call → Telnyx browser softphone + recording  
3. Script / objections / notes / outcome  
4. Optional Close deal on same screen  

### Close on phone
1. Brand + packages + pay type + fields  
2. Send contract (template fill → e-sign → Lark email)  
3. Client signs → webhook → store PDF private + status signed  
4. Send pay/DD link → webhook → update deal + **auto** commission credit for the agent  
   (never ask staff to “log commission” manually)

### Admin
- Edit scripts per user or bulk  
- Edit contract templates  
- Later: manage numbers, packages, commission rules  

---

## UI wiring map (where to hook)

| UI action | Hook later |
|-----------|------------|
| Call / End / mute / record | `lib/phone` (Telnyx) |
| Lark video start / invite | `lib/lark` VC reserve + mail invite link |
| Calling from auto/manual | Telnyx caller ID = selected e164 (phone channel only) |
| Notes blur | PATCH contact |
| Pipeline move | PATCH contact.stage |
| Save script / template | Admin APIs |
| Generate & send contract | contracts + lark + esign |
| Send Stripe / DD link | payments + lark → on paid webhook, auto commission_events |
| (removed) manual log sale | do not add this back |
| Warm-up brochure / info kit | `lib/lark` mail + asset links from storage |
| Reports | aggregate calls/deals |

Toasts today are mocks — replace with real success/error states without changing toast look much.

---

## Multi-brand rules

- Agent picks brand on Close deal and for which outbound brand lines appear.
- Separate Stripe products (and optionally separate Stripe accounts) per brand if money must split.
- GoCardless per brand if needed.
- Contract templates already keyed by `brandId` + `payType`.

---

## Legal / ops (do not skip)

- Call recording consent line  
- DNC / quiet hours enforcement  
- Do not spoof numbers you don’t own  
- Signed contracts only in private storage  
- Commission: define rules for one-off vs monthly vs deposit vs DD (refunds)

---

## Definition of done (backend MVP)

1. Auth (agent/admin)  
2. Contacts + notes + pipeline persisted  
3. Telnyx: place call from chosen number, record, show in recents  
4. Scripts/templates CRUD for admin  
5. Deal: contract send + signed PDF saved  
6. Stripe one-off + monthly + deposit link  
7. GoCardless DD link  
8. Commission log readable for admin  
9. **Zero drive-by UI redesign**

---

## Prompt Kathryn can paste to Claude

```
Work in /Users/kathryn/Projects/clickclick-crm.
Read docs/CLAUDE_HANDOFF.md and AGENTS.md first.
The frontend UI is approved — do not change index.css layout/branding or redesign App.tsx.
Add backend behind the existing screens: Telnyx voice, Supabase data, Stripe + GoCardless, e-sign + secure PDF storage, Lark email.
Put new code under src/lib/. Keep bubble UI and all features listed in the handoff.
```

---

## File map

| Path | Role |
|------|------|
| `src/App.tsx` | Full UI (dialer, pipeline, admin, close deal, from-number) |
| `src/index.css` | Brand + bubble styles |
| `src/data/mock.ts` | Types, seed data, `pickBestOutboundNumber` |
| `public/brand/` | Logos |
| `docs/CLAUDE_HANDOFF.md` | This file |
| `AGENTS.md` | Short agent rules |
