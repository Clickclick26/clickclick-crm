// PECR TPS/CTPS screening — checks contact phone numbers against the UK
// Telephone Preference Service / Corporate TPS registers before they're
// allowed into any outbound marketing call flow. "Public number" and
// "TPS/CTPS registered" are unrelated — a business can list its number on
// its own website and still be registered against exactly this kind of call.
//
// Called from inside the signed-in CRM only (not a public form like
// waitlist-ingest), so this keeps the default JWT verification — no
// supabase/config.toml entry needed, unlike waitlist-ingest.
//
// Provider: Provero (https://provero.io/checks/tps-ctps-screening) — chosen
// for transparent pay-per-check pricing (from £0.004/request, no minimum
// commitment), which fits a single-agent setup better than a subscription
// service.
//
// Endpoint/shape below is verified against Provero's real API docs
// (api.provero.io/docs) — an earlier version of this file guessed the shape
// from their public marketing page and had the wrong endpoint entirely
// (404s, not even reaching their app). Confirmed live: POST
// /api/validate/phone-tps, phone in full E.164 with the +, response is
// { onTps: boolean, registeredDate?, tpsExpiry? } — no field distinguishing
// personal TPS from corporate CTPS, so both collapse to "tps_registered"
// here; for "don't call this number" purposes that distinction doesn't
// matter anyway.
//
// Setup (Kathryn):
//   1. Sign up at https://provero.io, get an API key.
//   2. supabase secrets set PROVERO_API_KEY=your_key_here
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

type ScreenRequest = { contactIds: string[] }

type TpsStatus = "unscreened" | "clear" | "tps_registered" | "ctps_registered" | "check_failed"

// This function never had CORS handling — every call from the browser (via
// supabase.functions.invoke) was almost certainly blocked at the preflight
// stage this whole time, regardless of whether the code behind it worked.
// curl/server-to-server testing never catches this because there's no
// browser enforcing CORS — see lark-video-invite's header comment, same bug.
const ALLOWED_ORIGINS = new Set([
  "https://clickclick26.github.io",
  "https://crm.clickclick.video",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
])

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://clickclick26.github.io"
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
    Vary: "Origin",
  }
}

function json(status: number, body: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) })
}

/** UK number normalised to full E.164 with the + prefix, as Provero's real API expects. */
function normalizeUkNumber(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "")
  if (digits.startsWith("44")) return `+${digits}`
  if (digits.startsWith("0")) return `+44${digits.slice(1)}`
  if (digits.length >= 10) return `+44${digits}`
  return null
}

async function checkOneNumber(phone: string, apiKey: string): Promise<TpsStatus> {
  const normalized = normalizeUkNumber(phone)
  if (!normalized) return "check_failed"

  try {
    const res = await fetch("https://api.provero.io/api/validate/phone-tps", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone: normalized }),
    })

    if (!res.ok) {
      console.error("Provero TPS check failed:", res.status, await res.text())
      return "check_failed"
    }

    const data = (await res.json()) as { onTps?: boolean }
    return data.onTps === true ? "tps_registered" : "clear"
  } catch (err) {
    console.error("Provero TPS check error:", err)
    return "check_failed"
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

  const apiKey = Deno.env.get("PROVERO_API_KEY")
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "Server not configured (database)." }, origin)
  }
  if (!apiKey) {
    return json(
      200,
      {
        ok: false,
        configured: false,
        message:
          "TPS/CTPS screening isn't connected yet — sign up at provero.io and set PROVERO_API_KEY. Nothing was screened.",
      },
      origin,
    )
  }

  try {
    const body = (await req.json()) as ScreenRequest
    const contactIds = Array.isArray(body.contactIds) ? body.contactIds.slice(0, 500) : []
    if (contactIds.length === 0) {
      return json(400, { error: "contactIds required" }, origin)
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: contacts, error: fetchErr } = await admin
      .from("contacts")
      .select("id, phone")
      .in("id", contactIds)

    if (fetchErr) throw fetchErr

    let screened = 0
    let failed = 0

    // Sequential, not parallel — keeps this within Provero's per-second rate
    // limits without needing to know their exact ceiling, and a single-agent
    // setup has no volume pressure to justify the extra complexity yet.
    for (const c of contacts ?? []) {
      const status = c.phone ? await checkOneNumber(c.phone, apiKey) : "check_failed"
      const { error: updErr } = await admin
        .from("contacts")
        .update({ tps_status: status, tps_screened_at: new Date().toISOString() })
        .eq("id", c.id)
      if (updErr) {
        console.error("Failed to save TPS status for", c.id, updErr.message)
        failed++
      } else {
        screened++
        if (status === "check_failed") failed++
      }
    }

    return json(200, { ok: true, configured: true, screened, failed }, origin)
  } catch (err) {
    console.error("screen-tps-ctps error:", err)
    return json(500, { error: "Something went wrong." }, origin)
  }
})
