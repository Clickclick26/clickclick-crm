# ClickClick CRM

Call-centre CRM + **ClickClick Dialer** for ClickClick / CLocal.

## Run

```bash
npm install
npm run dev
```

## Brand

Same as [clickclick.video](https://www.clickclick.video/):

- Font: Poppins  
- Cream, turquoise `#00bcd4`, purple `#7b5ea7`, pink `#e83e8c`  
- Stacked logo top-left; horizontal in sidebar  
- Soft bubble UI  

## Frontend status

UI mock is **approved**. Features include dialer, from-number auto/manual, scripts/objections, notes, pipeline board, close deal (packages + pay types + contract/pay), admin script/contract editors, Lark stubs, reports/lists.

## For Claude / backend work

**Start here:** [`docs/CLAUDE_HANDOFF.md`](docs/CLAUDE_HANDOFF.md)  
Also: [`AGENTS.md`](AGENTS.md)

Do not redesign the UI. Add Telnyx, Supabase, Stripe, GoCardless, e-sign, Lark behind the existing screens.

## Planned plug-ins

1. Telnyx — numbers, dial, record, listen-in, caller ID  
2. Supabase — people, pipeline, deals, commission, private PDFs  
3. Stripe + GoCardless — pay types  
4. E-sign + Lark Mail — contracts  
5. Host on `crm.clickclick.video`  

## CLocal waitlist ingest

See [`docs/clocal-waitlist-ingest.md`](docs/clocal-waitlist-ingest.md) for Resend + Edge Function setup (`waitlist-ingest`).
