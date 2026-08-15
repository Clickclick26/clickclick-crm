// Public CLocal waitlist ingest: upsert CRM contact + send Resend confirm email.
// Deploy with JWT verification OFF (see supabase/config.toml).
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets, or `supabase secrets set`):
//   RESEND_API_KEY          — from resend.com (can share with lark-video-invite)
//   CLOCAL_MAIL_FROM        — e.g. "CLocal <hello@clocal.co.uk>"
//   SUPABASE_URL            — usually auto-injected
//   SUPABASE_SERVICE_ROLE_KEY — usually auto-injected
//
// No admin secrets in the browser. Protect with: origin allowlist, honeypot,
// soft validation, and a simple per-IP rate limit.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

type Body = {
  name?: string
  email?: string
  postcode?: string
  roles?: string[]
  newsletter?: boolean | string
  /** Honeypot — bots fill this; humans leave blank. */
  _honey?: string
  website?: string
}

const ALLOWED_ORIGINS = new Set([
  "https://clocal.co.uk",
  "https://www.clocal.co.uk",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
])

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/
const ALLOWED_ROLES = new Set(["Consumer", "Creator", "Business"])

/** Rough in-memory rate limit (resets when the isolate recycles). Good enough for waitlist MVP. */
const rateBucket = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 8
const RATE_WINDOW_MS = 60 * 60 * 1000

function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://clocal.co.uk"
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
    Vary: "Origin",
  }
}

function json(
  status: number,
  body: Record<string, unknown>,
  origin: string | null,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin),
  })
}

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  )
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateBucket.get(ip)
  if (!entry || now > entry.resetAt) {
    rateBucket.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count += 1
  return true
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`clocal-waitlist:${ip}`)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32)
}

function normalizePostcode(value: string): string {
  const compact = value.toUpperCase().replace(/\s+/g, "")
  if (compact.length < 5) return compact
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`
}

function inferRegion(postcode: string): "belfast" | "other" {
  const outward = postcode.toUpperCase().replace(/\s+/g, "")
  return outward.startsWith("BT") ? "belfast" : "other"
}

function parseNewsletter(value: boolean | string | undefined): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const v = value.trim().toLowerCase()
    if (v === "no" || v === "false" || v === "0") return false
  }
  return true
}

function sanitizeRoles(roles: unknown): string[] {
  if (!Array.isArray(roles)) return []
  const out: string[] = []
  for (const r of roles) {
    if (typeof r !== "string") continue
    const trimmed = r.trim()
    if (ALLOWED_ROLES.has(trimmed) && !out.includes(trimmed)) out.push(trimmed)
  }
  return out
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function firstName(name: string): string {
  const part = name.trim().split(/\s+/)[0] ?? "there"
  return part
}

function confirmEmailHtml(name: string): string {
  const who = escapeHtml(firstName(name))
  return `<!DOCTYPE html>
<html lang="en-GB">
<body style="margin:0;padding:0;background:#f4faf8;font-family:Nunito,Arial,sans-serif;color:#1a2e2a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4faf8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px 28px;">
          <tr>
            <td>
              <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#008080;font-weight:700;">CLocal</p>
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0b3d3a;">You're on the waitlist</h1>
              <p style="margin:0 0 14px;font-size:16px;line-height:1.55;">Hi ${who},</p>
              <p style="margin:0 0 14px;font-size:16px;line-height:1.55;">
                Thanks for joining. CLocal is invite-only in South Belfast right now.
                We help neighbours <strong>support local</strong>: real neighbourhood video,
                complimentary gift invites, and LocalGems near you.
              </p>
              <p style="margin:0 0 14px;font-size:16px;line-height:1.55;">
                When your invite is ready, we'll email you here. No spam. Just the good stuff.
              </p>
              <p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:#4a6662;">
                Support local,<br />The CLocal team
              </p>
              <p style="margin:20px 0 0;font-size:12px;color:#7a9290;">
                <a href="https://clocal.co.uk" style="color:#008080;">clocal.co.uk</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

async function sendConfirmEmail(opts: {
  apiKey: string
  from: string
  to: string
  name: string
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.from,
      to: [opts.to],
      subject: "You're on the CLocal waitlist",
      html: confirmEmailHtml(opts.name),
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Email send failed: ${text}`)
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin")

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders(origin) })
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" }, origin)
  }

  // Require a known browser Origin (or allow non-browser tools with no Origin for curl tests).
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json(403, { error: "Origin not allowed" }, origin)
  }

  const ip = clientIp(req)
  if (!checkRateLimit(ip)) {
    return json(429, { error: "Too many requests. Try again later." }, origin)
  }

  try {
    const body = (await req.json()) as Body

    // Honeypot: pretend success so bots stop retrying.
    if ((body._honey && String(body._honey).trim()) || (body.website && String(body.website).trim())) {
      return json(200, { ok: true }, origin)
    }

    const name = typeof body.name === "string" ? body.name.trim() : ""
    const emailRaw = typeof body.email === "string" ? body.email.trim() : ""
    const email = emailRaw.toLowerCase()
    const postcodeRaw = typeof body.postcode === "string" ? body.postcode.trim() : ""
    const roles = sanitizeRoles(body.roles)
    const newsletter = parseNewsletter(body.newsletter)

    if (!name || !email || !postcodeRaw || roles.length === 0) {
      return json(400, {
        error: "Please fill in name, email, postcode, and at least one role.",
      }, origin)
    }

    if (!EMAIL_RE.test(email)) {
      return json(400, { error: "Please enter a real email address." }, origin)
    }

    if (!UK_POSTCODE_RE.test(postcodeRaw.toUpperCase())) {
      return json(400, { error: "Please enter a UK postcode (e.g. BT7 1NN)." }, origin)
    }

    const postcode = normalizePostcode(postcodeRaw)
    const region = inferRegion(postcode)
    const roleTags = roles.map((r) => r.toLowerCase())
    // 'waitlist' and 'newsletter' are separate, non-exclusive CRM list tags —
    // a signup can be on both, and the Contacts screen filters on each
    // independently (see contactFilter in App.tsx). Do not merge these into
    // one tag; Kathryn explicitly wants them as separate lists with overlap.
    const tags = Array.from(
      new Set(["clocal", "waitlist", ...(newsletter ? ["newsletter"] : []), ...roleTags]),
    )
    const notesLine = [
      `Waitlist signup`,
      `postcode: ${postcode}`,
      `roles: ${roles.join(", ")}`,
      `newsletter: ${newsletter ? "yes" : "no"}`,
    ].join("\n")

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const resendKey = Deno.env.get("RESEND_API_KEY")
    const mailFrom =
      Deno.env.get("CLOCAL_MAIL_FROM") ?? "CLocal <hello@clocal.co.uk>"

    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: "Server not configured (database)." }, origin)
    }
    if (!resendKey) {
      return json(500, { error: "Server not configured (email)." }, origin)
    }

    const admin = createClient(supabaseUrl, serviceKey)

    // Upsert contact by email, scoped to brand_id='clocal' only. The same
    // person can be a real ClickClick sales contact AND a CLocal waitlist
    // signup under the same email — matching across brands would merge a
    // waitlist row into a live sales lead (or vice versa), exactly the
    // mixing this table's brand_id column exists to prevent. Two separate
    // contact rows for the same email, one per brand, is correct here.
    const { data: existingRows, error: findErr } = await admin
      .from("contacts")
      .select("id, name, tags, source, notes")
      .ilike("email", email)
      .eq("brand_id", "clocal")
      .limit(1)

    if (findErr) throw findErr

    const existing = existingRows?.[0] as
      | { id: string; name: string; tags: string[] | null; source: string; notes: string }
      | undefined

    let contactId: string

    if (existing) {
      const mergedTags = Array.from(
        new Set([...(existing.tags ?? []), ...tags]),
      )
      const mergedNotes = existing.notes?.includes("Waitlist signup")
        ? existing.notes
        : [existing.notes?.trim(), notesLine].filter(Boolean).join("\n\n")

      const { error: updErr } = await admin
        .from("contacts")
        .update({
          name: name || existing.name,
          tags: mergedTags,
          source: existing.source?.trim() ? existing.source : "clocal-waitlist",
          notes: mergedNotes,
          region,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)

      if (updErr) throw updErr
      contactId = existing.id
    } else {
      const { data: inserted, error: insErr } = await admin
        .from("contacts")
        .insert({
          name,
          email,
          phone: "",
          company: "",
          stage: "new",
          source: "clocal-waitlist",
          tags,
          notes: notesLine,
          region,
          timezone: "Europe/London",
          brand_id: "clocal",
        })
        .select("id")
        .single()

      if (insErr) throw insErr
      contactId = inserted.id as string
    }

    const ipHash = await hashIp(ip)
    const ua = (req.headers.get("user-agent") ?? "").slice(0, 300)

    const { error: signupErr } = await admin.from("waitlist_signups").insert({
      name,
      email,
      postcode,
      roles,
      newsletter,
      brand_id: "clocal",
      source: "clocal-waitlist",
      contact_id: contactId,
      ip_hash: ipHash,
      user_agent: ua,
    })

    // Signup row is best-effort audit; contact + email still proceed if table missing pre-migration.
    if (signupErr) {
      console.error("waitlist_signups insert failed:", signupErr.message)
    }

    await sendConfirmEmail({
      apiKey: resendKey,
      from: mailFrom,
      to: email,
      name,
    })

    return json(200, { ok: true }, origin)
  } catch (err) {
    console.error("waitlist-ingest error:", err)
    return json(500, { error: "Something went wrong. Please try again." }, origin)
  }
})
