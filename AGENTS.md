# Agent rules — ClickClick CRM

Before any work, read **`docs/CLAUDE_HANDOFF.md`**.

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
- Host target: `crm.clickclick.video`
- Pink `#e83e8c` for alerts/missed — not red

## Paste prompt

See bottom of `docs/CLAUDE_HANDOFF.md`.
