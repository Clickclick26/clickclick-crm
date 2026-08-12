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
// service. Not wired to a real account yet — this returns "not configured"
// until PROVERO_API_KEY is set.
//
// Setup (Kathryn):
//   1. Sign up at https://provero.io, get an API key.
//   2. supabase secrets set PROVERO_API_KEY=your_key_here
//   3. Confirm the request/response shape below still matches Provero's
//      actual docs once you can see them signed in — this was built from
//      their public marketing page, not their authenticated API reference,
//      so the auth header name/exact endpoint may need a one-line tweak.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

type ScreenRequest = { contactIds: string[] }

type TpsStatus = "unscreened" | "clear" | "tps_registered" | "ctps_registered" | "check_failed"

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

/** UK number normalised to the bare-digits E.164-ish shape Provero's example expects (447700900123, no + or spaces). */
function normalizeUkNumber(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "")
  if (digits.startsWith("44")) return digits
  if (digits.startsWith("0")) return `44${digits.slice(1)}`
  if (digits.length >= 10) return `44${digits}`
  return null
}

async function checkOneNumber(phone: string, apiKey: string): Promise<TpsStatus> {
  const normalized = normalizeUkNumber(phone)
  if (!normalized) return "check_failed"

  try {
    const res = await fetch("https://api.provero.io/v1/tps", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tps: { phone: normalized } }),
    })

    if (!res.ok) {
      console.error("Provero TPS check failed:", res.status, await res.text())
      return "check_failed"
    }

    const data = (await res.json()) as {
      tps?: { result?: boolean; status?: string }
    }

    // Provero's public docs show `result: true/false` alongside a status
    // string ("TPS registered" / "CTPS registered" / "Unlisted"). Handle
    // both shapes defensively since this wasn't verified against a real key.
    const statusText = (data.tps?.status ?? "").toLowerCase()
    if (statusText.includes("ctps")) return "ctps_registered"
    if (statusText.includes("tps")) return "tps_registered"
    if (data.tps?.result === true) return "tps_registered"
    return "clear"
  } catch (err) {
    console.error("Provero TPS check error:", err)
    return "check_failed"
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" })
  }

  const apiKey = Deno.env.get("PROVERO_API_KEY")
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "Server not configured (database)." })
  }
  if (!apiKey) {
    return json(200, {
      ok: false,
      configured: false,
      message:
        "TPS/CTPS screening isn't connected yet — sign up at provero.io and set PROVERO_API_KEY. Nothing was screened.",
    })
  }

  try {
    const body = (await req.json()) as ScreenRequest
    const contactIds = Array.isArray(body.contactIds) ? body.contactIds.slice(0, 500) : []
    if (contactIds.length === 0) {
      return json(400, { error: "contactIds required" })
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

    return json(200, { ok: true, configured: true, screened, failed })
  } catch (err) {
    console.error("screen-tps-ctps error:", err)
    return json(500, { error: "Something went wrong." })
  }
})
