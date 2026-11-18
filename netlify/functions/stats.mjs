// Lecture des statistiques agrégées — route GET /api/stats?days=7|30|90
// Protégée par mot de passe : en-tête « Authorization: Bearer <ADMIN_PASSWORD> ».
import { createHash, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { clampDays, lastDays, readDays } from "../lib/stats-core.mjs";

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
  "x-content-type-options": "nosniff",
};

const json = (status, data, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...HEADERS, ...extra } });

// Comparaison à temps constant (sur des empreintes de même longueur).
function samePassword(given, expected) {
  const a = createHash("sha256").update(String(given)).digest();
  const b = createHash("sha256").update(String(expected)).digest();
  return timingSafeEqual(a, b);
}

export default async (req, context) => {
  if (req.method !== "GET") return json(405, { error: "method_not_allowed" });

  const expected = Netlify.env.get("ADMIN_PASSWORD");
  if (!expected) return json(503, { error: "not_configured" });

  const auth = req.headers.get("authorization") || "";
  const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!given || given.length > 200 || !samePassword(given, expected)) {
    return json(401, { error: "unauthorized" }, { "www-authenticate": "Bearer" });
  }

  const days = clampDays(new URL(req.url).searchParams.get("days"));
  const production = !context?.deploy?.context || context.deploy.context === "production";
  const store = getStore({ name: production ? "stats" : "stats-preview", consistency: "strong" });

  try {
    return json(200, { days: await readDays(store, lastDays(days)) });
  } catch (err) {
    console.error("stats: échec de lecture", err?.message);
    return json(500, { error: "read_failed" });
  }
};

export const config = {
  path: "/api/stats",
  method: "GET",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["ip", "domain"],
    windowSize: 60,
    windowLimit: 20,
  },
};
