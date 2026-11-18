// Réponse automatique en message privé aux commentaires Instagram — route /api/ig-webhook
// Meta appelle cette adresse à chaque commentaire sur les comptes connectés à l'application.
// Si le commentaire contient le mot-clé (TUTO par défaut), on envoie UNE réponse privée à son auteur.
//
// Variables d'environnement Netlify (à créer par Alex, jamais dans le dépôt) :
//   IG_VERIFY_TOKEN      phrase libre, la même que celle saisie dans Meta (vérification du webhook)
//   IG_APP_SECRET        « App secret » de l'application Meta (App settings > Basic), sert à vérifier la signature des appels
//   IG_TOKEN_<ID>        jeton d'accès du compte, <ID> = identifiant numérique Instagram du compte
//   IG_DM_TEXT           message envoyé (optionnel) ; IG_DM_TEXT_<ID> pour un message propre à un compte
//   IG_KEYWORD           mot-clé (optionnel, TUTO par défaut)
import { createHmac, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";

const DEFAUT = "Voici ton tableau de blackjack, comme promis 👉 https://tutoblackjack.com\n\n18+ · Jouer comporte des risques.";
const txt = (status, body) => new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
const env = (k) => Netlify.env.get(k) || "";

function signatureOk(raw, header) {
  const secret = env("IG_APP_SECRET");
  if (!secret || !header || !header.startsWith("sha256=")) return false;
  const a = Buffer.from(header.slice(7), "hex");
  const b = createHmac("sha256", secret).update(raw).digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

async function repondre(compte, commentaire) {
  const token = env(`IG_TOKEN_${compte}`);
  if (!token) { console.warn("ig-webhook: pas de jeton pour le compte", compte); return; }
  const message = env(`IG_DM_TEXT_${compte}`) || env("IG_DM_TEXT") || DEFAUT;
  // Jeton « IG… » (Instagram Login) -> graph.instagram.com ; jeton « EAA… » (Unified / Facebook Login) -> graph.facebook.com
  const hote = token.startsWith("IG") ? "graph.instagram.com" : "graph.facebook.com";
  const r = await fetch(`https://${hote}/${compte}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ recipient: { comment_id: commentaire }, message: { text: message } }),
  });
  if (!r.ok) console.error("ig-webhook: envoi refusé", r.status, (await r.text()).slice(0, 300));
  return r.ok;
}

export default async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const attendu = env("IG_VERIFY_TOKEN");
    const ok = attendu && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === attendu;
    return ok ? txt(200, url.searchParams.get("hub.challenge") || "") : txt(403, "forbidden");
  }
  if (req.method !== "POST") return txt(405, "method not allowed");

  const raw = await req.text();
  if (raw.length > 200000 || !signatureOk(raw, req.headers.get("x-hub-signature-256"))) return txt(401, "bad signature");
  let data; try { data = JSON.parse(raw); } catch { return txt(400, "bad json"); }

  const motCle = (env("IG_KEYWORD") || "TUTO").toLowerCase();
  const store = getStore({ name: "ig-dm", consistency: "strong" });
  for (const entry of data.entry || []) {
    const compte = String(entry.id || "");
    if (!/^\d+$/.test(compte)) continue;
    for (const ch of entry.changes || []) {
      if (ch.field !== "comments" || !ch.value) continue;
      const v = ch.value, id = String(v.id || ""), texte = String(v.text || "").toLowerCase();
      if (!/^\d+$/.test(id) || !texte.includes(motCle)) continue;
      if (v.from && String(v.from.id) === compte) continue;           // nos propres commentaires
      try {
        if (await store.get(`c-${id}`)) continue;                      // déjà traité (Meta renvoie parfois deux fois)
        await store.set(`c-${id}`, new Date().toISOString());
        await repondre(compte, id);
      } catch (e) { console.error("ig-webhook: erreur", e?.message); }
    }
  }
  return txt(200, "ok");                                               // toujours 200, sinon Meta renvoie en boucle
};

export const config = { path: "/api/ig-webhook" };
