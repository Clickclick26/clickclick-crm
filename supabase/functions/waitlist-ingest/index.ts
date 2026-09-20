/**
 * CLocal waitlist robot
 * --------------------
 * 1) Save signup to waitlist_signups
 * 2) Best-effort upsert into CRM contacts (if that table exists)
 * 3) Send confirm email from hello@clocal.co.uk via Titan SMTP (123 Reg)
 *
 * Secrets (Supabase → Edge Functions → Secrets):
 *   TITAN_SMTP_HOST   default smtp.titan.email
 *   TITAN_SMTP_PORT   default 465
 *   TITAN_SMTP_USER   hello@clocal.co.uk
 *   TITAN_SMTP_PASS   mailbox password
 *   CLOCAL_MAIL_FROM  CLocal <hello@clocal.co.uk>
 *   CLOCAL_NOTIFY_TO  hello@clocal.co.uk  (optional admin ping)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import nodemailer from "npm:nodemailer@6.9.16";

const ALLOWED_ORIGINS = new Set([
  "https://clocal.co.uk",
  "https://www.clocal.co.uk",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/;
const ALLOWED_ROLES = new Set(["Consumer", "Creator", "Business"]);

type Body = {
  name?: unknown;
  email?: unknown;
  postcode?: unknown;
  roles?: unknown;
  newsletter?: unknown;
  /** utm_* tags the landing page captured on arrival. */
  utm?: unknown;
  _honey?: unknown;
};

function corsHeaders(origin: string | null): HeadersInit {
  const allow =
    origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://clocal.co.uk";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(
  status: number,
  body: Record<string, unknown>,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
    },
  });
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Rough per-IP rate limit. In-memory, so it resets whenever the isolate
 * recycles — that is fine for a waitlist: it exists to stop one source
 * hammering the form, not to be an exact quota. A real signer never gets
 * near 8 in an hour.
 */
const rateBucket = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 8;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateBucket.get(ip);
  if (!entry || now > entry.resetAt) {
    rateBucket.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count += 1;
  return true;
}

function normalizePostcode(value: string): string {
  const compact = value.toUpperCase().replace(/\s+/g, "");
  if (compact.length < 5) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

function inferRegion(postcode: string): string {
  if (!postcode) return "unknown";
  const out = postcode.toUpperCase().replace(/\s+/g, "");
  if (out.startsWith("BT7") || out.startsWith("BT9")) return "south-belfast";
  if (out.startsWith("BT")) return "belfast";
  return "other";
}

/**
 * The landing page has always sent these; this function used to drop them, so
 * every contact looked identical whether they came from a paid reel, a
 * Facebook group or straight to the site. Only the five standard keys are
 * kept, trimmed and length-capped, because this lands in the CRM as text.
 */
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

function parseUtm(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {};
  const src = v as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = asString(src[key]).slice(0, 120);
    if (value) out[key] = value;
  }
  return out;
}

/** "reel-three-miles via facebook / paid_social" — readable in a CRM note. */
function describeUtm(utm: Record<string, string>): string {
  if (!Object.keys(utm).length) return "";
  const what = utm.utm_content || utm.utm_campaign || "";
  const where = [utm.utm_source, utm.utm_medium].filter(Boolean).join(" / ");
  if (what && where) return `${what} via ${where}`;
  return what || where;
}

function parseRoles(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const roles = v
    .filter((r): r is string => typeof r === "string")
    .map((r) => r.trim())
    .filter((r) => ALLOWED_ROLES.has(r));
  return [...new Set(roles)];
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const host = (Deno.env.get("TITAN_SMTP_HOST") || "smtp.titan.email").trim();
  const port = Number((Deno.env.get("TITAN_SMTP_PORT") || "465").trim());
  const user = (Deno.env.get("TITAN_SMTP_USER") || "").trim();
  const pass = Deno.env.get("TITAN_SMTP_PASS") || "";
  const from =
    (Deno.env.get("CLOCAL_MAIL_FROM") || "CLocal <hello@clocal.co.uk>").trim();

  if (!user || !pass) {
    throw new Error("Mail is not set up yet. Missing Titan mailbox secrets.");
  }

  const secure = port === 465;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  try {
    await transporter.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`SMTP ${host}:${port} as ${user} — ${msg}`);
  } finally {
    transporter.close();
  }
}

function confirmCopy(name: string): { subject: string; text: string; html: string } {
  const first = name.split(/\s+/)[0] || "there";
  const subject = "You’re on the CLocal waitlist";
  const text =
    `Hi ${first},\n\n` +
    `You’re on the CLocal waitlist. We’ll email you when your invite is ready.\n\n` +
    `Love local,\nCLocal\nhttps://clocal.co.uk\n`;
  const html =
    `<p>Hi ${escapeHtml(first)},</p>` +
    `<p>You’re on the <strong>CLocal</strong> waitlist. We’ll email you when your invite is ready.</p>` +
    `<p>Love local,<br/>CLocal<br/><a href="https://clocal.co.uk">clocal.co.uk</a></p>`;
  return { subject, text, html };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Use POST." }, origin);
  }

  // Require a known Origin — a missing one counts as not allowed. Browsers
  // always send it; a script posting straight at this URL usually sends none,
  // and this function had no origin gate at all. That is the shape of the
  // 5 Sep 2026 form-spam probe on the FormSubmit side: scrape the endpoint out
  // of the page, post to it directly, skip every check the page runs. The daily
  // canary in the clocal-landing repo sends `Origin: https://clocal.co.uk`, so
  // it keeps passing — add the header to any new curl checks.
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return json(403, { error: "Origin not allowed" }, origin);
  }

  if (!checkRateLimit(clientIp(req))) {
    return json(429, { error: "Too many requests. Try again later." }, origin);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, { error: "Invalid JSON." }, origin);
  }

  // Honeypot: pretend success, do nothing.
  if (asString(body._honey)) {
    return json(200, { ok: true }, origin);
  }

  const name = asString(body.name);
  const email = asString(body.email).toLowerCase();
  const postcodeRaw = asString(body.postcode);
  const roles = parseRoles(body.roles);
  const utm = parseUtm(body.utm);
  const newsletter =
    body.newsletter === true ||
    body.newsletter === "yes" ||
    body.newsletter === "true";

  // Postcode is optional from 20 Sep 2026. It was required here as well as on
  // the form, so making the form field optional alone would have turned every
  // blank-postcode signup into a 400 the visitor sees as an error. The waitlist
  // only needs a name and an email to tell someone it is their turn.
  if (!name || !email || roles.length === 0) {
    return json(
      400,
      { error: "Please fill in name, email, and at least one role." },
      origin,
    );
  }

  if (!EMAIL_RE.test(email)) {
    return json(
      400,
      { error: "Please enter a real email address (like name@example.com)." },
      origin,
    );
  }

  if (postcodeRaw && !UK_POSTCODE_RE.test(postcodeRaw.toUpperCase().trim())) {
    return json(
      400,
      { error: "Please enter a UK postcode (e.g. BT7 1NN)." },
      origin,
    );
  }

  const postcode = postcodeRaw ? normalizePostcode(postcodeRaw) : "";
  const region = inferRegion(postcode);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return json(500, { error: "Server is not configured yet." }, origin);
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const row = {
    name,
    email,
    postcode,
    roles,
    newsletter,
    source: "clocal-waitlist",
    region,
    confirm_email_status: "pending",
    confirm_email_error: null as string | null,
    raw: {
      user_agent: req.headers.get("user-agent"),
      origin,
      utm,
    },
  };

  const { data: saved, error: saveError } = await sb
    .from("waitlist_signups")
    .upsert(row, { onConflict: "email" })
    .select("id")
    .maybeSingle();

  if (saveError) {
    console.error("waitlist save failed", saveError);
    // Temporary detail so we can finish setup; remove once stable.
    return json(
      500,
      {
        error: "Could not save your signup. Please try again.",
        detail: saveError.message,
        code: saveError.code ?? null,
      },
      origin,
    );
  }

  const signupId = saved?.id as string | undefined;

  // Best-effort CRM contacts sync (schema may vary; never fail the waitlist).
  // Uses an explicit "does a row with this email already exist?" check
  // instead of upsert(...{onConflict:"email"}) — that form only works if
  // contacts.email actually has a unique constraint/index in the database,
  // and it silently throws a Postgres planning error if it doesn't. Doing
  // it this way works regardless of whether that constraint exists.
  let contactSyncStatus: "created" | "updated" | "failed" = "failed";
  let contactSyncError: string | null = null;
  let contactId: string | null = null;
  try {
    const tags = ["clocal", "waitlist", ...roles.map((r) => r.toLowerCase())];
    if (newsletter) tags.push("newsletter");
    // Tag paid traffic so it can be filtered in the CRM without reading notes.
    if (utm.utm_medium && /paid|cpc|ppc/i.test(utm.utm_medium)) tags.push("paid-ad");
    if (utm.utm_source) tags.push(`src:${utm.utm_source}`.slice(0, 40));

    const campaign = describeUtm(utm);
    const notes = [
      `postcode: ${postcode || "not given"}`,
      `roles: ${roles.join(", ")}`,
      `newsletter: ${newsletter ? "yes" : "no"}`,
      campaign ? `campaign: ${campaign}` : "",
    ]
      .filter(Boolean)
      .join("; ");
    // contacts.phone is NOT NULL with no default — must always be set.
    // contacts.region only allows belfast/london/scotland/wales/other —
    // "south-belfast" (from inferRegion, used for the waitlist_signups row
    // above) isn't a valid value here, so it's sanitized before this insert.
    // brand_id must be explicit too, or it silently defaults to 'clickclick'.
    const contactRegion = region === "south-belfast" ? "belfast" : region;
    const contactPayload = {
      name,
      email,
      phone: "",
      source: "clocal-waitlist",
      tags,
      stage: "new",
      region: contactRegion,
      brand_id: "clocal",
      notes,
    };

    const { data: existing, error: lookupErr } = await sb
      .from("contacts")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (lookupErr) {
      throw lookupErr;
    }

    if (existing?.id) {
      const { error: updateErr } = await sb
        .from("contacts")
        .update(contactPayload)
        .eq("id", existing.id);
      if (updateErr) throw updateErr;
      contactId = existing.id as string;
      contactSyncStatus = "updated";
    } else {
      const { data: inserted, error: insertErr } = await sb
        .from("contacts")
        .insert(contactPayload)
        .select("id")
        .maybeSingle();
      if (insertErr) throw insertErr;
      contactId = (inserted?.id as string | undefined) ?? null;
      contactSyncStatus = "created";
    }
  } catch (err) {
    contactSyncStatus = "failed";
    contactSyncError = err instanceof Error ? err.message : String(err);
    console.warn("contacts sync error", contactSyncError);
  }

  let confirmStatus = "sent";
  let confirmError: string | null = null;
  try {
    const copy = confirmCopy(name);
    await sendMail({ to: email, ...copy });

    const notifyTo = Deno.env.get("CLOCAL_NOTIFY_TO") || "hello@clocal.co.uk";
    try {
      await sendMail({
        to: notifyTo,
        subject: `CLocal waitlist: ${name}`,
        text:
          `New waitlist signup\n\n` +
          `Name: ${name}\nEmail: ${email}\nPostcode: ${postcode || "not given"}\n` +
          `Roles: ${roles.join(", ")}\nNewsletter: ${newsletter ? "yes" : "no"}\n` +
          `Region: ${region}\n`,
        html:
          `<p><strong>New waitlist signup</strong></p>` +
          `<ul>` +
          `<li>Name: ${escapeHtml(name)}</li>` +
          `<li>Email: ${escapeHtml(email)}</li>` +
          `<li>Postcode: ${escapeHtml(postcode || "not given")}</li>` +
          `<li>Roles: ${escapeHtml(roles.join(", "))}</li>` +
          `<li>Newsletter: ${newsletter ? "yes" : "no"}</li>` +
          `<li>Region: ${escapeHtml(region)}</li>` +
          `</ul>`,
      });
    } catch (notifyErr) {
      console.warn("admin notify failed", notifyErr);
    }
  } catch (err) {
    confirmStatus = "failed";
    confirmError = err instanceof Error ? err.message : String(err);
    console.error("confirm email failed", confirmError);
  }

  if (signupId) {
    // Persist the CRM sync outcome as well as the mail outcome. Without this
    // a failed contacts write left no trace anywhere: the status was returned
    // in the HTTP response, the browser ignored it, and the signup reported
    // success. Someone could tick the newsletter box, be told they were on the
    // list, and never exist in contacts (migration 0017).
    const { error: statusErr } = await sb
      .from("waitlist_signups")
      .update({
        confirm_email_status: confirmStatus,
        confirm_email_error: confirmError,
        contact_sync_status: contactSyncStatus,
        contact_sync_error: contactSyncError,
        contact_id: contactId,
      })
      .eq("id", signupId);
    // Last line of defence: if even this write fails, say so in the logs
    // rather than losing the fact that the sync failed.
    if (statusErr) {
      console.error(
        "waitlist status write failed",
        JSON.stringify({
          signupId,
          contactSyncStatus,
          contactSyncError,
          error: statusErr.message,
        }),
      );
    }
  }

  // A failed contacts write is a real problem, not a warning: this person is on
  // the waitlist but is not in the CRM, and if they ticked newsletter they will
  // never be reachable. Log it at error level so it surfaces in the function
  // logs instead of hiding among warnings.
  if (contactSyncStatus === "failed") {
    console.error(
      "contacts sync FAILED — signup saved but contact missing",
      JSON.stringify({ signupId, email, newsletter, error: contactSyncError }),
    );
  }

  // Signup is saved even if mail failed — user still sees success.
  // During setup, surface mail + contact-sync status so we can fix issues
  // quickly instead of guessing. Remove contactSyncError/mailError once
  // both are reliably working.
  return json(
    200,
    {
      ok: true,
      mail: confirmStatus,
      mailError: confirmError,
      contactSync: contactSyncStatus,
      contactSyncError,
    },
    origin,
  );
});