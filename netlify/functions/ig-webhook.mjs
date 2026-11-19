// Réponse automatique en message privé aux commentaires Instagram — route /api/ig-webhook
// Meta appelle cette adresse à chaque commentaire sur les comptes connectés à l'application.
// Si le commentaire contient le mot-clé (TUTO par défaut), on envoie UNE réponse privée à son auteur.
//
// Variables d'environnement Netlify (à créer par Alex, jamais dans le dépôt) :
//   IG_VERIFY_TOKEN      phrase libre, la même que celle saisie dans Meta (vérification du webhook)
//   IG_APP_SECRET        « App secret » de l'application Meta (App settings > Basic), sert à vérifier la signature des appels
//   IG_TOKEN_<ID>        jeton d'accès du compte, <ID> = identifiant numérique Instagram du compte
//   IG_DM_TEXT, IG_DM_LINK, IG_DM_BUTTON   texte, lien et libellé du bouton (optionnels) ; IG_DM_TEXT_<ID> / IG_DM_LINK_<ID> pour un compte précis
//   IG_KEYWORD           mot-clé (optionnel, TUTO par défaut)
import { createHmac, timingSafeEqual } from "node:crypto";
import { env, magasin, motCle, correspond, traiter, noter } from "../lib/ig-core.mjs";

const txt = (status, body) => new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

function signatureOk(raw, header) {
  const secret = env("IG_APP_SECRET");
  if (!secret || !header || !header.startsWith("sha256=")) return false;
  const a = Buffer.from(header.slice(7), "hex");
  const b = createHmac("sha256", secret).update(raw).digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async (req) => {
  const url = new URL(req.url);
  const store = magasin();
  if (req.method === "GET") {
    const attendu = env("IG_VERIFY_TOKEN");
    if (url.searchParams.get("journal") === "1") {
      const ok = attendu && (req.headers.get("authorization") || "") === `Bearer ${attendu}`;
      return ok ? new Response(JSON.stringify({ dernier_releve: await store.get("dernier-releve", { type: "json" }), journal: (await store.get("journal", { type: "json" })) || [] }), { headers: { "content-type": "application/json", "cache-control": "no-store" } }) : txt(403, "forbidden");
    }
    const ok = attendu && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === attendu;
    return ok ? txt(200, url.searchParams.get("hub.challenge") || "") : txt(403, "forbidden");
  }
  if (req.method !== "POST") return txt(405, "method not allowed");

  const raw = await req.text();
  if (raw.length > 200000 || !signatureOk(raw, req.headers.get("x-hub-signature-256"))) return txt(401, "bad signature");
  let data; try { data = JSON.parse(raw); } catch { return txt(400, "bad json"); }

  const mot = motCle();
  for (const entry of data.entry || []) {
    const compte = String(entry.id || "");
    if (!/^\d+$/.test(compte)) continue;
    for (const ch of entry.changes || []) {
      if (ch.field !== "comments" || !ch.value) continue;
      const v = ch.value, id = String(v.id || "");
      if (!/^\d+$/.test(id) || !correspond(v.text || "", mot)) continue;
      if (v.from && String(v.from.id) === compte) continue;           // nos propres commentaires
      try { await traiter(store, compte, id, "webhook"); }
      catch (e) { await noter(store, { source: "webhook", compte, ok: false, erreur: String(e?.message).slice(0, 200) }); }
    }
  }
  return txt(200, "ok");                                               // toujours 200, sinon Meta renvoie en boucle
};

export const config = { path: "/api/ig-webhook" };
