// Collecte des événements de mesure d'audience — route POST /api/t
// N'enregistre ni adresse IP, ni user-agent, ni identifiant : uniquement des compteurs par jour.
import { getStore } from "@netlify/blobs";
import { MAX_BODY, dayKey, isBot, recordBatch, validatePayload } from "../lib/stats-core.mjs";

const done = (status = 204) => new Response(null, { status, headers: { "cache-control": "no-store" } });

export default async (req, context) => {
  if (req.method !== "POST") return done(405);

  // Le user-agent sert uniquement à écarter les robots ; il n'est jamais stocké ni journalisé.
  if (isBot(req.headers.get("user-agent"))) return done();

  // Requêtes venant d'un autre site : refusées.
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(req.url).host) return done(403);
    } catch {
      return done(403);
    }
  }

  let text;
  try {
    text = await req.text();
  } catch {
    return done(400);
  }
  if (!text || text.length > MAX_BODY) return done(400);

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return done(400);
  }

  const batch = validatePayload(body);
  if (!batch) return done(400);

  // Les aperçus de déploiement n'écrivent pas dans les statistiques de production.
  const production = !context?.deploy?.context || context.deploy.context === "production";
  const store = getStore({ name: production ? "stats" : "stats-preview", consistency: "strong" });

  try {
    const saved = await recordBatch(store, dayKey(), batch);
    if (!saved) console.warn("stats: lot abandonné après 5 conflits d'écriture");
  } catch (err) {
    console.error("stats: échec d'écriture", err?.message);
    return done(500);
  }
  return done();
};

export const config = {
  path: "/api/t",
  method: "POST",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["ip", "domain"],
    windowSize: 60,
    windowLimit: 120,
  },
};
