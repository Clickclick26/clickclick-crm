// Looks up a small business's likely owner/contact name and phone number via
// Gemini + Google Search grounding, for the "Look up with AI" button on the
// New Contact form. Review-only: this never writes to the database itself —
// the CRM shows what it found and the agent decides whether to save it.
//
// Grounding (the google_search tool) is required, not optional. Without it,
// Gemini will confidently invent plausible-sounding names and phone numbers
// for small local businesses instead of saying it doesn't know — which is
// exactly the wrong failure mode for a tool that feeds a real dialer.
//
// Secret required: GEMINI_API_KEY — from https://aistudio.google.com/apikey
//   supabase secrets set GEMINI_API_KEY=your_key_here
//
// Model: gemini-3.6-flash — Google's own API error is what named this one;
// gemini-2.5-flash (current as of this code being written) had already been
// retired for new callers. If a future call 404s the same way, the error
// message tells you the replacement model name directly.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

type Body = {
  company: string
  locality?: string
  brand?: string
}

type LookupResult = {
  found: boolean
  ownerName: string | null
  phone: string | null
  email: string | null
  confidence: "high" | "medium" | "low"
  source: string | null
  note: string | null
}

// Same cross-origin situation as lark-video-invite / screen-tps-ctps — the
// CRM calls this from github.io / crm.clickclick.video / local dev, so it
// needs to handle the browser's CORS preflight itself.
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

  const apiKey = Deno.env.get("GEMINI_API_KEY")
  if (!apiKey) {
    return json(
      200,
      {
        configured: false,
        message:
          "AI lookup isn't connected yet — get a key at aistudio.google.com/apikey and set GEMINI_API_KEY.",
      },
      origin,
    )
  }

  try {
    const body = (await req.json()) as Body
    const company = (body.company ?? "").trim()
    if (!company) return json(400, { error: "Company name required" }, origin)
    const locality = (body.locality ?? "").trim()
    const brand = body.brand === "clocal" ? "CLocal" : "ClickClick"

    const where = locality ? ` in ${locality}` : ""
    const prompt = `Find the real, currently-correct owner or main contact name and public phone number for the small business "${company}"${where}. This is for a UK sales team (${brand}) about to call them — accuracy matters, a wrong number means calling the wrong person.

Use search to confirm current info; do not guess. If you can't confirm a fact, leave it null rather than inventing one.

Reply with ONLY a single JSON object, no other text, no markdown fences, matching exactly this shape:
{"found": boolean, "ownerName": string|null, "phone": string|null, "email": string|null, "confidence": "high"|"medium"|"low", "source": string|null, "note": string|null}

"source" is the website or listing you found this on, if any. "note" is one short sentence if something is uncertain or ambiguous, otherwise null.`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0 },
        }),
      },
    )

    if (!res.ok) {
      const text = await res.text()
      console.error("Gemini API error:", res.status, text)
      return json(502, { error: "Lookup failed — try again in a moment." }, origin)
    }

    const data = await res.json()
    const parts = data?.candidates?.[0]?.content?.parts as { text?: string }[] | undefined
    const text = parts?.map((p) => p.text ?? "").join("")

    if (!text) {
      return json(
        200,
        { configured: true, found: false, note: "No answer returned." },
        origin,
      )
    }

    // The model sometimes wraps JSON in ```json fences despite instructions not to.
    const cleaned = text
      .trim()
      .replace(/^```(json)?/i, "")
      .replace(/```$/, "")
      .trim()

    let parsed: Partial<LookupResult>
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error("Could not parse Gemini response as JSON:", text)
      return json(
        200,
        { configured: true, found: false, note: "Could not read the AI's answer — try again." },
        origin,
      )
    }

    const confidence =
      parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
        ? parsed.confidence
        : "low"

    return json(
      200,
      {
        configured: true,
        found: Boolean(parsed.found),
        ownerName: typeof parsed.ownerName === "string" ? parsed.ownerName : null,
        phone: typeof parsed.phone === "string" ? parsed.phone : null,
        email: typeof parsed.email === "string" ? parsed.email : null,
        confidence,
        source: typeof parsed.source === "string" ? parsed.source : null,
        note: typeof parsed.note === "string" ? parsed.note : null,
      },
      origin,
    )
  } catch (err) {
    console.error("lookup-contact-info error:", err)
    return json(500, { error: "Something went wrong." }, origin)
  }
})
