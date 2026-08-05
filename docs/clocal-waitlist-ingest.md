# CLocal waitlist ingest (Edge Function)

Public form on [clocal.co.uk](https://clocal.co.uk) posts to Supabase Edge Function `waitlist-ingest`.

## What it does

1. Soft-validates name, email, UK postcode, roles
2. Upserts a `contacts` row: `source=clocal-waitlist`, tags `clocal`, `waitlist`, roles
3. Inserts a `waitlist_signups` audit row (migration `0008_waitlist_signups.sql`)
4. Sends a short confirm email via **Resend** from `hello@clocal.co.uk`

## Kathryn setup checklist

### 1. Resend account

1. Sign up at [resend.com](https://resend.com) (free tier is fine for waitlist volume).
2. Add domain **clocal.co.uk**.
3. Copy the DNS records Resend shows (SPF + DKIM, sometimes a verification TXT).

### 2. 123reg DNS

In **123reg** → domain **clocal.co.uk** → DNS:

1. Add the Resend **SPF** / **DKIM** / verify records exactly as shown.
2. Do **not** delete existing GitHub Pages A records for the website.
3. If you already have an SPF TXT on `@`, merge includes (one SPF record only). Resend’s docs explain how to combine.
4. Wait for Resend to show the domain as **Verified** (can take minutes to a few hours).

### 3. Supabase secrets

In the **clickclick-crm** Supabase project → **Project Settings → Edge Functions → Secrets** (or CLI):

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxx
supabase secrets set CLOCAL_MAIL_FROM="CLocal <hello@clocal.co.uk>"
```

- Paste the Resend API key in the **dashboard** (or CLI on your machine). Never commit it. Never paste it in chat.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are normally injected by Supabase for Edge Functions. If local serve fails, set them too.

### 4. Apply migration + deploy function

From this repo (linked to the CRM project):

```bash
supabase db push
# or run supabase/migrations/0008_waitlist_signups.sql in the SQL Editor

supabase functions deploy waitlist-ingest
```

Confirm `verify_jwt = false` for this function (see `supabase/config.toml`).

### 5. Point the landing site

Function URL shape:

```text
https://<PROJECT_REF>.supabase.co/functions/v1/waitlist-ingest
```

In **clocal-landing** `config.js`, set:

```js
window.CLOCAL_CONFIG = {
  waitlistUrl: "https://<PROJECT_REF>.supabase.co/functions/v1/waitlist-ingest",
};
```

Commit + push the landing repo so GitHub Pages picks it up.

### 6. Test

1. Open https://clocal.co.uk (or local `python3 -m http.server 5173`).
2. Submit the waitlist with a real inbox you control.
3. Check CRM → Contacts for `source=clocal-waitlist` and tags.
4. Check that inbox for the CLocal confirm email (and Spam once).
5. Check Resend dashboard → Emails for delivery status.

## Security model (MVP)

Static GitHub Pages **cannot** hide secrets. This function is intentionally public and relies on:

- CORS allowlist (`clocal.co.uk` + localhost)
- Honeypot field
- Soft email/postcode validation
- Per-IP rate limit (~8/hour per isolate)
- Service role + Resend key **only** in Supabase secrets

## Local serve (optional)

```bash
supabase functions serve waitlist-ingest --env-file supabase/.env.local
```

Do not commit `.env.local`.
