// Free-form "ask AI about this company" box on the contact profile — e.g.
// "what do they sell", "how big are they", "any news on them". Plain-text
// answer, not structured. Same deal as lookup-contact-info: no Google
// Search grounding (Kathryn's account is free-tier; grounding needs a
// linked billing account on Google's side regardless of volume — see that
// function's header comment for how this was confirmed). This is Gemini's
// training memory, not a live lookup, and the prompt leans hard on saying
// "I don't know" over guessing.
//
// Secret required: GEMINI_API_KEY — same one lookup-contact-info uses.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

type Body = {
  company: string
  locality?: string
  brand?: string
  question: string
}

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
          "AI isn't connected yet — get a key at aistudio.google.com/apikey and set GEMINI_API_KEY.",
      },
      origin,
    )
  }

  try {
    const body = (await req.json()) as Body
    const company = (body.company ?? "").trim()
    const question = (body.question ?? "").trim()
    if (!company) return json(400, { error: "Company name required" }, origin)
    if (!question) return json(400, { error: "Question required" }, origin)
    const locality = (body.locality ?? "").trim()
    const brand = body.brand === "clocal" ? "CLocal" : "ClickClick"
    const where = locality ? ` in ${locality}` : ""

    const prompt = `You do NOT have live internet or search access — only what you already learned during
training, which may be outdated or wrong, or you may not know this specific business at all.
That's fine and expected; say so plainly rather than guessing.

A ${brand} salesperson is asking about the business "${company}"${where}, to help them prepare
for a call. Their question: "${question}"

Answer in 2-4 short plain sentences, UK English. If you don't specifically recognise this
business or aren't confident in the answer, say that directly instead of speculating — e.g.
"I don't have reliable info on this specific business." Never invent specifics (numbers, names,
dates) to sound more helpful than you actually are.

Reply with ONLY the answer text — no JSON, no markdown, no preamble like "Here's what I know".`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
      },
    )

    if (!res.ok) {
      const text = await res.text()
      console.error("Gemini API error:", res.status, text)
      return json(502, { error: "Ask failed — try again in a moment." }, origin)
    }

    const data = await res.json()
    const parts = data?.candidates?.[0]?.content?.parts as { text?: string }[] | undefined
    const answer = parts?.map((p) => p.text ?? "").join("").trim()

    return json(
      200,
      { configured: true, answer: answer || "No answer returned." },
      origin,
    )
  } catch (err) {
    console.error("ask-about-company error:", err)
    return json(500, { error: "Something went wrong." }, origin)
  }
})
