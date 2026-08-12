// Creates a Lark video meeting and emails the join link to a contact.
// Secrets required (set via `supabase secrets set` or the dashboard):
//   LARK_APP_ID, LARK_APP_SECRET       — from the Lark custom app
//   LARK_MEETING_OWNER_ID              — a Lark user's open_id to own reserved meetings
//   RESEND_API_KEY                     — from resend.com
//   MAIL_FROM                          — e.g. "ClickClick <hello@clickclick.video>"
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Body = {
  contactName: string
  contactEmail: string
  agentName: string
  brand?: string
  /** If set, re-send this existing link instead of reserving a new meeting. */
  existingJoinUrl?: string
}

async function getTenantAccessToken(appId: string, appSecret: string) {
  const res = await fetch(
    "https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    },
  )
  const data = await res.json()
  if (data.code !== 0) {
    throw new Error(`Lark auth failed: ${data.msg ?? "unknown error"}`)
  }
  return data.tenant_access_token as string
}

async function reserveMeeting(
  accessToken: string,
  ownerId: string,
  topic: string,
): Promise<string> {
  const endTime = Math.floor(Date.now() / 1000) + 2 * 60 * 60 // 2 hours from now
  const res = await fetch("https://open.larksuite.com/open-apis/vc/v1/reserves/apply", {
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
    if (!body.contactName || !body.contactEmail || !body.agentName) {
      return json(400, { error: "Missing required fields" }, origin)
    }

    const resendKey = Deno.env.get("RESEND_API_KEY")
    const mailFrom = Deno.env.get("MAIL_FROM")

    if (!resendKey || !mailFrom) {
      return json(500, { error: "Server not configured" }, origin)
    }

    let joinUrl = body.existingJoinUrl
    if (!joinUrl) {
      const appId = Deno.env.get("LARK_APP_ID")
      const appSecret = Deno.env.get("LARK_APP_SECRET")
      const ownerId = Deno.env.get("LARK_MEETING_OWNER_ID")
      if (!appId || !appSecret || !ownerId) {
        return json(500, { error: "Server not configured" }, origin)
      }
      const accessToken = await getTenantAccessToken(appId, appSecret)
      const topic = `${body.brand ?? "ClickClick"} call with ${body.contactName}`
      joinUrl = await reserveMeeting(accessToken, ownerId, topic)
    }

    await sendInviteEmail({
      apiKey: resendKey,
      from: mailFrom,
      to: body.contactEmail,
      agentName: body.agentName,
      contactName: body.contactName,
      joinUrl,
    })

    return json(200, { joinUrl }, origin)
  } catch (err) {
    return json(500, { error: (err as Error).message }, origin)
  }
})
