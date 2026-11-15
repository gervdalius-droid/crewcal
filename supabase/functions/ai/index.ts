// Supabase Edge Function: "ai"
// All CrewCal AI features go through here. Prompts are built server-side from a
// few typed parameters, so this is not a general-purpose Gemini proxy.
//
// Checks, in order: signed-in user → active member of the crew → monthly quota.
//
// Deploy:
//   supabase secrets set GEMINI_API_KEY=...            (required)
//   supabase secrets set AI_FREE_MONTHLY=25            (optional, default 25)
//   supabase secrets set ALLOW_ORIGIN=https://crewcal.app   (optional, default *)
//   supabase functions deploy ai
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.1-flash-lite";
const FREE_MONTHLY = Number(Deno.env.get("AI_FREE_MONTHLY") ?? "25");
const ALLOW_ORIGIN = Deno.env.get("ALLOW_ORIGIN") ?? "*";

const cors = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const clip = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").slice(0, n).trim();
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

type Req = { kind: string; group_id: string; [k: string]: unknown };

function buildPrompt(r: Req): { prompt: string; search: boolean; temperature: number; tokens: number } {
  if (r.kind === "events") {
    // months: ["2026-11", "2027-01", ...]
    const months = (Array.isArray(r.months) ? r.months : []).map(String).filter((m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m)).slice(0, 12);
    const when = months.length ? months.map((m) => MONTHS[Number(m.slice(5)) - 1] + " " + m.slice(0, 4)).join(", ") : "the next three months";
    const q = clip(r.query, 200);
    const cats = (Array.isArray(r.categories) ? r.categories : []).map((c) => clip(c, 30)).filter(Boolean);
    const near = clip(r.near, 80);
    const what = q ? `events matching "${q}"` : `notable events${cats.length ? " in these categories: " + cats.join(", ") : ""}`;
    return {
      search: true, temperature: 0.2, tokens: 4000,
      prompt:
        `Find 12-18 real ${what} happening in ${when}${near ? `, preferably in or near ${near}` : " in Europe or worldwide"}.\n` +
        `Only include events that really exist with confirmed or highly likely dates, and that have not already happened (today is ${new Date().toISOString().slice(0, 10)}). A group of friends will use this to plan a trip together.\n\n` +
        `Return ONLY a JSON array, no prose. Each item:\n` +
        `{"title":"Official event name","category":"Music|Motorsport|Sport|Festival|Culture|Food|Nightlife|Outdoors|Other",` +
        `"location":"City, Country","starts_on":"YYYY-MM-DD","ends_on":"YYYY-MM-DD","price_min":number|null,"price_max":number|null,` +
        `"url":"official website","blurb":"one sentence on why it's worth going"}\n` +
        `Prices are typical ticket prices in EUR; null if unknown. URLs must be the real official site, never a placeholder.`,
    };
  }
  if (r.kind === "places") {
    const q = clip(r.query, 200);
    if (!q) throw new Error("Say what you're looking for");
    return {
      search: true, temperature: 0.2, tokens: 3000,
      prompt:
        `Suggest 8-10 real, currently open places for a group of friends matching: "${q}".\n` +
        `Return ONLY a JSON array, no prose. Each item:\n` +
        `{"name":"Place name","type":"bar|restaurant|cafe|club|activity|park|venue|other","city":"City","address":"Street address",` +
        `"blurb":"one sentence on what makes it good for a group","price":"€|€€|€€€|€€€€","hours":"typical opening hours","rating":number|null}`,
    };
  }
  if (r.kind === "trip") {
    const title = clip(r.title, 120), location = clip(r.location, 100);
    const from = clip(r.starts_on, 10), to = clip(r.ends_on, 10), origin = clip(r.origin, 80);
    const guests = Math.max(1, Math.min(30, Number(r.guests) || 2));
    return {
      search: false, temperature: 0.6, tokens: 500,
      prompt:
        `A group of ${guests} friends${origin ? ` from ${origin}` : ""} is going to "${title}" in ${location}, ${from} to ${to}.\n` +
        `Write a practical brief in 4-5 short sentences: what the place is like then (weather, vibe), one or two tips specific to this event, ` +
        `which area to stay in, and how to get around. Plain text, no markdown, no lists.`,
    };
  }
  if (r.kind === "brief") {
    // Client sends already-computed facts (free windows, ideas); the model only writes them up.
    const facts = clip(JSON.stringify(r.facts ?? {}), 4000);
    return {
      search: false, temperature: 0.7, tokens: 400,
      prompt:
        `You are the planner for a group of friends. From these facts (JSON) write a short, upbeat recommendation ` +
        `(3-4 sentences, plain text) of WHEN they should meet next and WHAT to do. Mention concrete dates. Facts: ${facts}`,
    };
  }
  throw new Error("Unknown request");
}

function extractText(d: any): string {
  const parts = d?.candidates?.[0]?.content?.parts ?? [];
  return parts.filter((p: any) => p.text && !p.thought).map((p: any) => p.text).join("").trim();
}

async function gemini(prompt: string, search: boolean, temperature: number, tokens: number) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`;
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: tokens },
  };
  if (search) body.tools = [{ google_search: {} }];
  let r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  // Grounding can be unavailable for a model/tier: retry once without it.
  if (!r.ok && search && r.status !== 429) {
    delete body.tools;
    r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d?.error?.message ?? `Gemini HTTP ${r.status}`), { status: r.status });
  return extractText(d);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!GEMINI_KEY) return json({ error: "AI is not configured yet" }, 503);

  const authHeader = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: "Sign in first" }, 401);

  let r: Req;
  try { r = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const { data: mem } = await admin.from("members").select("status")
    .eq("group_id", r.group_id).eq("user_id", user.id).maybeSingle();
  if (mem?.status !== "active") return json({ error: "Not a member of this crew" }, 403);

  const month = new Date().toISOString().slice(0, 7);
  const [{ data: prof }, { data: use }] = await Promise.all([
    admin.from("profiles").select("plan").eq("id", user.id).maybeSingle(),
    admin.from("ai_usage").select("count").eq("user_id", user.id).eq("month", month).maybeSingle(),
  ]);
  const used = use?.count ?? 0;
  const limit = prof?.plan === "pro" ? Infinity : FREE_MONTHLY;
  if (used >= limit) return json({ error: "quota", used, limit }, 402);

  let spec;
  try { spec = buildPrompt(r); } catch (e) { return json({ error: (e as Error).message }, 400); }

  try {
    const text = await gemini(spec.prompt, spec.search, spec.temperature, spec.tokens);
    if (!text) return json({ error: "The AI returned nothing — try again" }, 502);
    await admin.from("ai_usage").upsert({ user_id: user.id, month, count: used + 1 });
    return json({ text, used: used + 1, limit: Number.isFinite(limit) ? limit : null });
  } catch (e) {
    const status = (e as any).status === 429 ? 429 : 502;
    return json({ error: status === 429 ? "AI is busy right now — try again in a minute" : (e as Error).message }, status);
  }
});
