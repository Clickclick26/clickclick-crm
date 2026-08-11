# Agent rules — ClickClick CRM

Before any work, read:

1. **`docs/START_HERE_CLAUDE.md`** (hosting, URLs, code map, Aug 2026 status)
2. **`docs/CLAUDE_HANDOFF.md`** (product + backend plan)

## UI is locked

Kathryn approved this dialer UI. Do **not** redesign it.

- Do not casually edit `src/index.css` colours, radii, layout, or typography.
- Do not replace the bubble card layout or remove features to “simplify.”
- Wire backend under `src/lib/`; keep `App.tsx` screens and flows.

## Product facts

- Brands: ClickClick + CLocal (more later)
- Phone: **Telnyx**
- Pay: Stripe (one-off / deposit / monthly) + GoCardless (UK Direct Debit)
- Contracts: template → e-sign → private storage; send via Lark
- Host target: `crm.clickclick.video` (today often via GitHub Pages — see START_HERE)
- Pink `#e83e8c` for alerts/missed — not red

## Sister apps

- Landing: `/Users/kathryn/Projects/clickclick-landing` — do not mix into CRM
- Academy: `/Users/kathryn/Projects/clickclick-academy` — separate static Pages site

## Paste prompt

See bottom of `docs/START_HERE_CLAUDE.md`.
