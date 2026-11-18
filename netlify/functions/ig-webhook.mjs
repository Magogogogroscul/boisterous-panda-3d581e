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
import { getStore } from "@netlify/blobs";

const DM_TEXTE = "Hey ! Comme promis, ton tableau du Blackjack est prêt ! 🃏\n\nClique juste ici 👇 pour le récupérer et l'avoir toujours sous la main !";
const DM_BOUTON = "Clique ici";
const DM_LIEN = "https://tutoblackjack.com/";
// Réponse publique sous le commentaire : une au hasard à chaque fois.
const PUBLIQUES = [
  "Je te l'ai envoyé ✨ (Regarde dans tes invitations par message)",
  "Regarde tes DM 📩 (Regarde dans tes invitations par message)",
  "Envoyé en message privé 💌 (Regarde dans tes invitations par message)",
  "Fait ! Regarde tes messages ✅ (Regarde dans tes invitations par message)",
];
const txt = (status, body) => new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
const env = (k) => Netlify.env.get(k) || "";
const hote = (token) => (token.startsWith("IG") ? "graph.instagram.com" : "graph.facebook.com");

function signatureOk(raw, header) {
  const secret = env("IG_APP_SECRET");
  if (!secret || !header || !header.startsWith("sha256=")) return false;
  const a = Buffer.from(header.slice(7), "hex");
  const b = createHmac("sha256", secret).update(raw).digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

// Le mot-clé compte quelle que soit la façon de l'écrire : majuscules, accents, espaces, points, emojis,
// seul ou au milieu d'une phrase (« TUTO », « tuto svp », « T.U.T.O », « Tutô 🙌 », « je veux le tuto »).
function correspond(texte, motCle) {
  const nu = String(texte).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
  return nu.includes(motCle);
}

async function appel(url, token, corps) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(corps) });
  return { ok: r.ok, status: r.status, detail: r.ok ? "" : (await r.text()).slice(0, 300) };
}

// Message privé avec bouton ; si Instagram refuse le bouton, on renvoie le même texte avec le lien en clair.
async function envoyerDM(compte, commentaire, token) {
  const texte = env(`IG_DM_TEXT_${compte}`) || env("IG_DM_TEXT") || DM_TEXTE;
  const lien = env(`IG_DM_LINK_${compte}`) || env("IG_DM_LINK") || DM_LIEN;
  const bouton = env("IG_DM_BUTTON") || DM_BOUTON;
  const url = `https://${hote(token)}/${compte}/messages`;
  const avecBouton = await appel(url, token, {
    recipient: { comment_id: commentaire },
    message: { attachment: { type: "template", payload: { template_type: "button", text: texte, buttons: [{ type: "web_url", url: lien, title: bouton }] } } },
  });
  if (avecBouton.ok) return { ok: true, forme: "bouton" };
  const simple = await appel(url, token, { recipient: { comment_id: commentaire }, message: { text: `${texte}\n\n${lien}` } });
  return simple.ok ? { ok: true, forme: "texte", bouton_refuse: avecBouton.detail } : { ok: false, erreur: simple.detail, erreur_bouton: avecBouton.detail, status: simple.status };
}

async function repondrePublic(commentaire, token) {
  const message = PUBLIQUES[Math.floor(Math.random() * PUBLIQUES.length)];
  return appel(`https://${hote(token)}/${commentaire}/replies`, token, { message });
}

// Journal des 30 derniers envois (sans nom ni identifiant de personne), pour vérifier que tout marche.
async function noter(store, ligne) {
  try {
    const j = (await store.get("journal", { type: "json" })) || [];
    j.unshift({ t: new Date().toISOString(), ...ligne });
    await store.setJSON("journal", j.slice(0, 30));
  } catch (e) { console.error("ig-webhook: journal", e?.message); }
}

export default async (req) => {
  const url = new URL(req.url);
  const store = getStore({ name: "ig-dm", consistency: "strong" });
  if (req.method === "GET") {
    const attendu = env("IG_VERIFY_TOKEN");
    if (url.searchParams.get("journal") === "1") {
      const ok = attendu && (req.headers.get("authorization") || "") === `Bearer ${attendu}`;
      return ok ? new Response(JSON.stringify((await store.get("journal", { type: "json" })) || []), { headers: { "content-type": "application/json", "cache-control": "no-store" } }) : txt(403, "forbidden");
    }
    const ok = attendu && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === attendu;
    return ok ? txt(200, url.searchParams.get("hub.challenge") || "") : txt(403, "forbidden");
  }
  if (req.method !== "POST") return txt(405, "method not allowed");

  const raw = await req.text();
  if (raw.length > 200000 || !signatureOk(raw, req.headers.get("x-hub-signature-256"))) return txt(401, "bad signature");
  let data; try { data = JSON.parse(raw); } catch { return txt(400, "bad json"); }

  const motCle = (env("IG_KEYWORD") || "TUTO").toLowerCase();
  for (const entry of data.entry || []) {
    const compte = String(entry.id || "");
    if (!/^\d+$/.test(compte)) continue;
    for (const ch of entry.changes || []) {
      if (ch.field !== "comments" || !ch.value) continue;
      const v = ch.value, id = String(v.id || "");
      if (!/^\d+$/.test(id) || !correspond(v.text || "", motCle)) continue;
      if (v.from && String(v.from.id) === compte) continue;           // nos propres commentaires
      if (v.parent_id) continue;                                       // réponse à un autre commentaire
      try {
        if (await store.get(`c-${id}`)) continue;                      // déjà traité (Meta renvoie parfois deux fois)
        await store.set(`c-${id}`, new Date().toISOString());
        const token = env(`IG_TOKEN_${compte}`);
        if (!token) { await noter(store, { compte, ok: false, erreur: "pas de jeton pour ce compte" }); continue; }
        const dm = await envoyerDM(compte, id, token);
        const pub = dm.ok ? await repondrePublic(id, token) : null;
        await noter(store, { compte, dm, reponse_publique: pub ? (pub.ok ? "ok" : pub.detail) : "non tentée" });
      } catch (e) { console.error("ig-webhook: erreur", e?.message); await noter(store, { compte, ok: false, erreur: String(e?.message).slice(0, 200) }); }
    }
  }
  return txt(200, "ok");                                               // toujours 200, sinon Meta renvoie en boucle
};

export const config = { path: "/api/ig-webhook" };
