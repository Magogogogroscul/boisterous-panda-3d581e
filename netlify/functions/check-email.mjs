// Vérifie qu'une adresse email a une chance d'exister — route GET /api/check-email?email=…
// Contrôle la forme, refuse les domaines jetables, puis interroge le DNS : le domaine doit avoir un serveur de courrier.
// L'adresse n'est ni enregistrée ni journalisée ici.
import { resolveMx } from "node:dns/promises";

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
  "x-content-type-options": "nosniff",
};
const json = (status, data) => new Response(JSON.stringify(data), { status, headers: HEADERS });

const DISPOSABLE = new Set([
  "yopmail.com", "yopmail.fr", "yopmail.net", "mailinator.com", "guerrillamail.com", "guerrillamail.net", "sharklasers.com",
  "10minutemail.com", "10minutemail.net", "temp-mail.org", "tempmail.com", "tempmail.net", "throwawaymail.com", "trashmail.com",
  "getnada.com", "maildrop.cc", "dispostable.com", "fakeinbox.com", "mailnesia.com", "mohmal.com", "emailondeck.com",
  "jetable.org", "mail-temporaire.fr", "minutemail.com", "tempr.email", "discard.email", "spamgourmet.com", "mytemp.email",
  "moakt.com", "tmpmail.org", "tmpmail.net", "burnermail.io", "inboxkitten.com", "mailcatch.com", "cool.fr.nf", "courriel.fr.nf",
]);

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

export default async (req) => {
  if (req.method !== "GET") return json(405, { ok: false, reason: "method" });
  const email = (new URL(req.url).searchParams.get("email") || "").trim().toLowerCase();
  if (email.length < 6 || email.length > 254 || !/^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(email)) {
    return json(200, { ok: false, reason: "format" });
  }
  const domain = email.slice(email.lastIndexOf("@") + 1);
  if (DISPOSABLE.has(domain)) return json(200, { ok: false, reason: "disposable" });
  try {
    const mx = await withTimeout(resolveMx(domain), 2500);
    const usable = Array.isArray(mx) && mx.some((r) => r && r.exchange && r.exchange !== "." && r.exchange !== "");
    return json(200, usable ? { ok: true } : { ok: false, reason: "domain" });
  } catch (err) {
    const code = err && err.code;
    // Domaine inexistant ou sans serveur de courrier : refus. Panne ou délai DNS : on laisse passer.
    if (code === "ENOTFOUND" || code === "ENODATA") return json(200, { ok: false, reason: "domain" });
    return json(200, { ok: true, unverified: true });
  }
};

export const config = {
  path: "/api/check-email",
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 30 },
};
