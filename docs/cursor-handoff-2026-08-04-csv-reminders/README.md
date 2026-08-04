# Cursor handoff — CSV upload + follow-up reminders

**Date:** 2026-08-04  
**From:** Cursor (Kathryn out of Claude credits for a few hours)  
**Repo:** `clickclick-crm`  
**Status:** Built in the working tree, **NOT committed**. Claude has other changes — please review, merge carefully, then commit when Kathryn is ready.

---

## What Kathryn wants

Email-first CRM (no phone yet). Contracts/emails stay manual.

1. **CSV upload** for cold / campaign people:
   - Tag `replied` = got back to us
   - Tag `warmed` = warmed up
   - Do **not** dump thousands onto the pipeline board — tags only for bulk
   - Pipeline stays for people she works by hand

2. **Follow-up reminders**
   - Due tab + count
   - Banner when due
   - Toast once per day on load
   - Browser Notification if allowed
   - Date picker on contact (“Follow-up”)
   - CSV `follow_up` column as `YYYY-MM-DD`

---

## Files in this handoff

| Path in this folder | Goes to in repo |
|---------------------|-----------------|
| `files/src/lib/csv.ts` | `src/lib/csv.ts` (**new**) |
| `files/src/lib/reminders.ts` | `src/lib/reminders.ts` (**new**) |
| `files/src/lib/supabase/contacts.ts` | `src/lib/supabase/contacts.ts` |
| `files/src/App.tsx` | `src/App.tsx` |
| `files/src/index.css` | `src/index.css` |
| `changes.patch` | diff vs last commit for App/css/contacts only |

---

## What Claude should do later

1. Open this folder and read this README.
2. Diff against **current** `main` / Kathryn’s latest Claude work — **do not blind-overwrite** `App.tsx` if you changed it since.
3. Prefer applying `changes.patch` if clean; otherwise merge by hand:
   - Keep Cursor’s CSV upload button + contact filters (All / Replied / Warmed / Due)
   - Keep `importCsvContacts`, `updateContactFollowUp`, `isFollowUpDue`
   - Keep reminder banner + follow-up date field
   - Keep your other Claude features
4. Update `docs/CLAUDE_HANDOFF.md` feature list:
   - CSV import (tags `replied` / `warmed`)
   - Follow-up date + Due reminders (in-app + browser notify)
   - Still: no Telnyx required for email MVP
5. Run `npm run build`
6. Commit when Kathryn asks (suggested message below)

### Suggested commit message

```
Add CSV contact import and follow-up reminders for email outreach

Bulk import uses replied/warmed tags so pipeline stays for hand-worked leads.
Due tab, banner, daily toast, and optional browser notifications surface follow-ups.
```

---

## CSV format (for Kathryn / docs)

```text
name,email,company,tag,notes,follow_up
Jane Cafe,jane@cafe.com,Jane's Cafe,replied,Said yes to chat,2026-08-10
Bob Bakery,bob@bakery.com,Bob's,warmed,Opened emails,2026-08-12
```

- `tag` = `replied` or `warmed`
- `follow_up` = `YYYY-MM-DD` (optional)
- Match on email; update if exists, insert if new
- New rows stay stage `new`, source `email-campaign`

---

## Hard rules (same as handoff)

- Do **not** redesign the UI
- Do **not** remove dialer/close-deal features — Kathryn just isn’t using them yet
- Phone / Telnyx / Lark send / Stripe still later

---

## Paste prompt for Claude later

```
Work in /Users/kathryn/Projects/clickclick-crm.
Read docs/cursor-handoff-2026-08-04-csv-reminders/README.md first.
Cursor added CSV import + follow-up reminders while I was out of credits.
Merge those into the current tree carefully (I may have other Claude changes).
Do not redesign UI. Then run npm run build and commit when I say so.
```
