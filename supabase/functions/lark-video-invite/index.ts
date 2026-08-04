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

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  try {
    const body: Body = await req.json()
    if (!body.contactName || !body.contactEmail || !body.agentName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const resendKey = Deno.env.get("RESEND_API_KEY")
    const mailFrom = Deno.env.get("MAIL_FROM")

    if (!resendKey || !mailFrom) {
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    let joinUrl = body.existingJoinUrl
    if (!joinUrl) {
      const appId = Deno.env.get("LARK_APP_ID")
      const appSecret = Deno.env.get("LARK_APP_SECRET")
      const ownerId = Deno.env.get("LARK_MEETING_OWNER_ID")
      if (!appId || !appSecret || !ownerId) {
        return new Response(JSON.stringify({ error: "Server not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
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

    return new Response(JSON.stringify({ joinUrl }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
