// Données de la page de suivi — route GET /api/suivi
// Protégée par mot de passe : en-tête « Authorization: Bearer <mot de passe> ».
// Le mot de passe est accepté s'il correspond à la variable ADMIN_PASSWORD (si elle existe)
// ou à l'empreinte scrypt ci-dessous (le mot de passe lui-même n'est écrit nulle part).
import { createHash, scryptSync, timingSafeEqual } from "node:crypto";
import data from "../data/suivi.json" with { type: "json" };

const EMPREINTE = "6720900c274bbae0a72af0ebdda9fa38:aaa9737a17a1d13972a52e0c50fc5e57e5741e0bf8422028ff6f3a04225f5629";

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
  "x-content-type-options": "nosniff",
};
const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });

function ok(given) {
  const env = Netlify.env.get("ADMIN_PASSWORD");
  if (env) {
    const a = createHash("sha256").update(given).digest();
    const b = createHash("sha256").update(String(env)).digest();
    if (timingSafeEqual(a, b)) return true;
  }
  const [salt, hash] = EMPREINTE.split(":").map((x) => Buffer.from(x, "hex"));
  const got = scryptSync(given, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(got, hash);
}

export default async (req) => {
  if (req.method !== "GET") return json(405, { error: "method_not_allowed" });
  const auth = req.headers.get("authorization") || "";
  const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!given || given.length > 200 || !ok(given)) {
    return json(401, { error: "unauthorized" }, { "www-authenticate": "Bearer" });
  }
  return json(200, data);
};

export const config = {
  path: "/api/suivi",
  method: "GET",
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 10 },
};
