# START HERE — Claude (ClickClick CRM)

Read this file first, then `docs/CLAUDE_HANDOFF.md`, then `AGENTS.md`.

Owner: **Kathryn**. Talk to her in short, plain sentences.

---

## What this repo is

**ClickClick CRM + Dialer** — call-centre desk for ClickClick (+ CLocal).

- UI is **approved and locked**. Do not redesign.
- Wire backends under `src/lib/` (and Supabase). Keep `App.tsx` screens.

---

## Paths

| What | Path |
|------|------|
| Local project | `/Users/kathryn/Projects/clickclick-crm` |
| GitHub | https://github.com/Clickclick26/clickclick-crm |
| Live (GitHub Pages) | https://clickclick26.github.io/clickclick-crm/ |
| Custom domain (target) | `https://crm.clickclick.video/` |

Marketing site (separate): `/Users/kathryn/Projects/clickclick-landing` → `https://www.clickclick.video/`  
Academy (separate): `/Users/kathryn/Projects/clickclick-academy` — see that folder’s `CLAUDE.md`.

---

## Run locally

```bash
cd /Users/kathryn/Projects/clickclick-crm
npm install
npm run dev
```

Needs `.env` / Vite env with at least:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Never commit secrets.

---

## Hosting / DNS (important — Aug 2026)

### Live today

- Site is on **GitHub Pages** from branch **`gh-pages`**.
- Working URL: **https://clickclick26.github.io/clickclick-crm/**
- Custom domain `crm.clickclick.video` was configured in Pages before, then cleared so github.io works while DNS is unfinished.

### Domain

- Apex / www: **clickclick.video** already live (landing).
- DNS is managed in **123-reg** (not only GoDaddy). Nameservers may still show domaincontrol in places — use the panel Kathryn has open.
- Subdomains need **their own** records. Website live ≠ `crm` / `academy` auto-exist.

### DNS Kathryn is adding (123-reg)

| Type | Name | Value |
|------|------|--------|
| CNAME | `crm` | `Clickclick26.github.io` |
| CNAME | `academy` | `Clickclick26.github.io` |

After DNS works:

1. Put `CNAME` file (`crm.clickclick.video`) back on **`gh-pages`** (or set custom domain in GitHub Pages settings).
2. Set Vite `base: '/'` again for apex-style custom domain (today project Pages need `base: '/clickclick-crm/'` if staying on github.io path).
3. Asset paths must use `import.meta.env.BASE_URL` (logos broke when they were absolute `/brand/...`).

### Deploy CRM to Pages

```bash
npm run build
# copy dist/ → gh-pages branch root (no CNAME while on github.io project URL)
# push gh-pages
```

There may be a worktree under `/private/tmp/.../gh-pages-wt` from earlier Cursor work.

---

## Git branches (watch this)

| Branch | Notes |
|--------|--------|
| `main` | Primary. May be **ahead of origin** locally. |
| `gh-pages` | Built static site for Pages. |
| `feat/clocal-waitlist-ingest` | Adds Resend waitlist edge function + `0008_waitlist_signups.sql`. Not necessarily merged. |

Before big work: `git status`, `git branch -v`, `git log --oneline -8`.

---

## Code map (read in this order)

| Path | Why |
|------|-----|
| `AGENTS.md` | Hard UI rules |
| `docs/CLAUDE_HANDOFF.md` | Product + backend plan (long) |
| `docs/clocal-waitlist-ingest.md` | Waitlist → CRM + Resend |
| `src/main.tsx` | Entry |
| `src/components/AuthGate.tsx` | Session gate |
| `src/components/Login.tsx` | Sign in / sign up |
| `src/App.tsx` | **All main UI** (dialer, pipeline, admin…) — huge; edit carefully |
| `src/index.css` | Brand / bubbles — **do not restyle** |
| `src/data/mock.ts` | Types + seed + `pickBestOutboundNumber` |
| `src/lib/supabase/client.ts` | Supabase client |
| `src/lib/supabase/auth.ts` | Auth helpers |
| `src/lib/supabase/contacts.ts` | Contacts |
| `src/lib/supabase/*.ts` | deals, referrals, infoKits, lark, agents, profile, types |
| `src/lib/csv.ts` | CSV contact import |
| `src/lib/reminders.ts` | Follow-up reminders |
| `src/lib/instagram.ts` | IG helpers |
| `src/lib/contractPdf.ts` | Contract PDF (may live on feature branch / WIP) |
| `public/brand/` | Logos |
| `supabase/migrations/` | Schema |
| `supabase/functions/lark-video-invite/` | Lark VC invite |
| `supabase/functions/waitlist-ingest/` | On `feat/clocal-waitlist-ingest` |

Older Cursor note: `docs/cursor-handoff-2026-08-04-csv-reminders/` (CSV work history).

---

## Product rules (short)

- Brands: ClickClick + CLocal
- Phone: **Telnyx** (not Twilio unless blocked)
- Pay: Stripe + GoCardless
- Contracts: template → e-sign → private storage; Lark for send
- Pink `#e83e8c` for alerts — **not red**
- No commission wording / no “That’s a win” button
- Host target name: `crm.clickclick.video`

Full inventory: `docs/CLAUDE_HANDOFF.md`.

---

## Known issues / context for Claude

1. **Logo on GitHub Pages** — absolute `/brand/...` breaks on project Pages. Fix with `` `${import.meta.env.BASE_URL}brand/...` ``. Fix was deployed to `gh-pages`; confirm `main` source matches before next build.
2. **Vite `base`** — for `https://clickclick26.github.io/clickclick-crm/` use `base: '/clickclick-crm/'`. For custom domain at site root use `base: '/'`.
3. **Resend / verification emails** — Kathryn had trouble getting Resend domain/account verification emails. Website DNS ≠ email sender verified. Waitlist confirm mail can stay blocked until Resend domain works (DNS TXT often better than waiting on email).
4. **Do not touch** clickclick-landing when working CRM/Academy.

---

## Sister project: Academy

```
/Users/kathryn/Projects/clickclick-academy
```

- Static site: `index.html`, `app.js`, `styles.css`, `courses.json`, `packs.json`
- Live: https://clickclick26.github.io/clickclick-academy/ (and `academy.clickclick.video` after DNS)
- Access code for Kathryn: `Clickclick123` (full catalog)
- Read that repo’s `CLAUDE.md`

---

## Paste prompt (Kathryn → Claude)

```
Work in /Users/kathryn/Projects/clickclick-crm.
Read docs/START_HERE_CLAUDE.md first, then docs/CLAUDE_HANDOFF.md and AGENTS.md.
UI is locked — do not redesign index.css or App.tsx layout.
Live CRM: https://clickclick26.github.io/clickclick-crm/
Custom domain crm.clickclick.video needs 123-reg CNAME → Clickclick26.github.io.
Put integrations under src/lib/ + supabase/. Keep all existing dialer/CRM features.
Academy is a separate repo: /Users/kathryn/Projects/clickclick-academy (read CLAUDE.md there).
```
