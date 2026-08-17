// Looks up a small business's likely owner/contact name and phone number via
// Gemini, for the "Look up with AI" button on the New Contact form.
// Review-only: this never writes to the database itself — the CRM shows
// what it found and the agent decides whether to save it.
//
// No Google Search grounding — Kathryn's account is on the free tier, and
// grounding is billed-account-only on Google's side (confirmed directly:
// plain generateContent calls succeed, the same call with the google_search
// tool 429s immediately, every time, regardless of volume). Deliberate
// tradeoff, decided with Kathryn: without grounding this is Gemini's
// training-data memory, not a live lookup, so it WILL be wrong or blank for
// businesses it doesn't already know about, especially small/local ones.
// The prompt below leans hard on "leave it null rather than guess", and the
// CRM UI labels every result as an unverified AI guess. If billing ever gets
// enabled on that Google Cloud project, add back `tools: [{ google_search: {} }]`
// to the request body and this becomes a real lookup instead of a memory
// dump — worth revisiting then.
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
    const prompt = `You do NOT have live internet or search access for this — you only have what you already
learned during training, which may be outdated, wrong, or nonexistent for a small local business
like this one. That is completely fine and expected most of the time.

The business: "${company}"${where}. A UK sales team (${brand}) is about to call whatever number
you give them — a wrong number means calling a real stranger by mistake.

Your #1 rule: it is always better to say you don't know than to guess. Never invent a
plausible-sounding name, phone number, or email just to fill in a field. If you don't
specifically, confidently recall this exact business, set "found" to false and leave every
field null — do not make up a generic-sounding placeholder. Only answer if you actually
recognise this specific business by name from training and recall real specifics about it —
not a guess based on what businesses like this "usually" look like.

Reply with ONLY a single JSON object, no other text, no markdown fences, matching exactly this shape:
{"found": boolean, "ownerName": string|null, "phone": string|null, "email": string|null, "confidence": "high"|"medium"|"low", "source": string|null, "note": string|null}

"confidence" should be "low" unless you are quite sure. "source" is where you believe you learned
this from, if you recall one, otherwise null. "note" is one short sentence flagging any doubt —
e.g. "this may be outdated" — otherwise null.`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
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
