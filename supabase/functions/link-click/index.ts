/**
 * CLocal link-click counter
 * -------------------------
 * The /r/<slug>/ pages on clocal.co.uk bounce people to the site with a
 * utm_campaign attached. Until now the ONLY way we found out a group post had
 * worked was if someone signed up, so a post that sent forty people and
 * converted none looked exactly like a post nobody saw. This counts the click.
 *
 * Deliberately stores nothing about the person: no IP, no user agent, no
 * cookie, no id. Just which link was clicked and when. Nothing is written to
 * the visitor's device either, so it does not need a consent banner under
 * PECR, which is the whole reason Clarity cannot do this job.
 *
 * Table (see link_clicks.sql):
 *   create table public.link_clicks (
 *     id bigserial primary key,
 *     slug text not null,
 *     campaign text,
 *     clicked_at timestamptz not null default now()
 *   );
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = new Set([
  "https://clocal.co.uk",
  "https://www.clocal.co.uk",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

/** Slugs we actually publish. Anything else is ignored, so a scraper that
 *  finds this endpoint cannot fill the table with junk rows. */
const KNOWN_SLUGS = new Set([
  "sbni", "beauty", "beautyads", "eastbiz",
  "whatson", "buysell", "intl", "bt7", "enjoy", "tots",
]);

function corsHeaders(origin: string | null): HeadersInit {
  const allow =
    origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://clocal.co.uk";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: cors });
  }

  // Never fail loudly. A redirect page must bounce the visitor onwards even if
  // this whole function is broken, so every path below returns 200.
  try {
    const body = await req.json().catch(() => ({}));
    const slug = String(body?.slug ?? "").trim().toLowerCase();
    const campaign = String(body?.campaign ?? "").trim().slice(0, 80) || null;

    if (!KNOWN_SLUGS.has(slug)) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    await supabase.from("link_clicks").insert({ slug, campaign });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (_err) {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
