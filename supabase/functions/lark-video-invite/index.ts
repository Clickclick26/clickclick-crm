// Creates a Lark video meeting and (optionally) emails the join link to a contact.
// Secrets (Supabase Dashboard → Edge Functions → Secrets, or `supabase secrets set`):
//   LARK_APP_ID, LARK_APP_SECRET       — from the Lark custom app (Credentials & Basic Info)
//   LARK_MEETING_OWNER_EMAIL           — the Lark login email of the person who "owns"
//                                        reserved meetings (looked up to an open_id at runtime)
//   LARK_MEETING_OWNER_ID              — optional: skip the lookup and pass an open_id directly
//   RESEND_API_KEY                     — optional: from resend.com. If unset, we still reserve
//                                        the meeting and return the link (no email sent).
//   MAIL_FROM                          — optional: e.g. "ClickClick <hello@clickclick.video>"
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Body = {
  contactName: string
  contactEmail?: string
  agentName: string
  brand?: string
  /** If set, re-send this existing link instead of reserving a new meeting. */
  existingJoinUrl?: string
}

const LARK_BASE = "https://open.larksuite.com/open-apis"

async function getTenantAccessToken(appId: string, appSecret: string) {
  const res = await fetch(`${LARK_BASE}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  })
  const data = await res.json()
  if (data.code !== 0) {
    throw new Error(`Lark auth failed: ${data.msg ?? "unknown error"}`)
  }
  return data.tenant_access_token as string
}

/** Resolve a Lark login email to the user's open_id (needed as the meeting owner). */
async function getOpenIdByEmail(accessToken: string, email: string): Promise<string> {
  const res = await fetch(
    `${LARK_BASE}/contact/v3/users/batch_get_id?user_id_type=open_id`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ emails: [email], include_resigned: false }),
    },
  )
  const data = await res.json()
  if (data.code !== 0) {
    throw new Error(`Lark user lookup failed: ${data.msg ?? "unknown error"}`)
  }
  const openId = data.data?.user_list?.[0]?.user_id as string | undefined
  if (!openId) {
    throw new Error(`No Lark user found for ${email}`)
  }
  return openId
}

async function reserveMeeting(
  accessToken: string,
  ownerId: string,
  topic: string,
): Promise<string> {
  // Lark's reserve API takes only an expiry, not a start time — the link works
  // as soon as it exists and stays valid until end_time. 30 days is the max
  // Lark allows, which covers sending an invite well ahead of the actual call.
  const endTime = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
  const res = await fetch(`${LARK_BASE}/vc/v1/reserves/apply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      end_time: String(endTime),
      owner_id: ownerId,
      meeting_settings: { topic },
    }),
  })
  const data = await res.json()
  if (data.code !== 0) {
    throw new Error(`Lark reserve failed: ${data.msg ?? "unknown error"}`)
  }
  return data.data.reserve.url as string
}

async function sendInviteEmail(opts: {
  apiKey: string
  from: string
  to: string
  agentName: string
  contactName: string
  joinUrl: string
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
      subject: `Video call link from ${opts.agentName}`,
      html: `<p>Hi ${opts.contactName.split(" ")[0]},</p>
<p>${opts.agentName} would like to hop on a quick video call with you.</p>
<p><a href="${opts.joinUrl}">${opts.joinUrl}</a></p>
<p>See you there!</p>`,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Email send failed: ${text}`)
  }
}

// The CRM is invoked cross-origin (github.io / crm.clickclick.video / local dev), and
// supabase.functions.invoke() sends Authorization + apikey + Content-Type headers, which
// makes the browser preflight with OPTIONS first. Without CORS headers here, that preflight
// (and the real response) gets blocked client-side and this feature silently never fires.
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

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin")

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders(origin) })
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" }, origin)
  }

  try {
    const body: Body = await req.json()
    // contactEmail is optional — plenty of contacts don't have one on file yet.
    // We just skip emailing the link in that case; the meeting still gets created.
    if (!body.contactName || !body.agentName) {
      return json(400, { error: "Missing required fields" }, origin)
    }

    const resendKey = Deno.env.get("RESEND_API_KEY")
    const mailFrom = Deno.env.get("MAIL_FROM")

    let joinUrl = body.existingJoinUrl
    if (!joinUrl) {
      const appId = Deno.env.get("LARK_APP_ID")
      const appSecret = Deno.env.get("LARK_APP_SECRET")
      const ownerIdEnv = Deno.env.get("LARK_MEETING_OWNER_ID")
      const ownerEmail = Deno.env.get("LARK_MEETING_OWNER_EMAIL")
      if (!appId || !appSecret || (!ownerIdEnv && !ownerEmail)) {
        return json(500, { error: "Server not configured (Lark)" }, origin)
      }
      const accessToken = await getTenantAccessToken(appId, appSecret)
      const ownerId = ownerIdEnv || (await getOpenIdByEmail(accessToken, ownerEmail!))
      const topic = `${body.brand ?? "ClickClick"} call with ${body.contactName}`
      joinUrl = await reserveMeeting(accessToken, ownerId, topic)
    }

    // Email is best-effort: if Resend isn't set up yet, the agent still gets the
    // link back to copy/paste or send via Lark chat.
    let emailed = false
    if (resendKey && mailFrom && body.contactEmail) {
      try {
        await sendInviteEmail({
          apiKey: resendKey,
          from: mailFrom,
          to: body.contactEmail,
          agentName: body.agentName,
          contactName: body.contactName,
          joinUrl,
        })
        emailed = true
      } catch (mailErr) {
        console.error("lark-video-invite email failed:", (mailErr as Error).message)
      }
    }

    return json(200, { joinUrl, emailed }, origin)
  } catch (err) {
    return json(500, { error: (err as Error).message }, origin)
  }
})
