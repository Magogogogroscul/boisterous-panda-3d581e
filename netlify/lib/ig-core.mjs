// Logique commune des réponses automatiques Instagram (webhook et relevé périodique).
import { getStore } from "@netlify/blobs";

export const DM_TEXTE = "Hey ! Comme promis, ton tableau du Blackjack est prêt ! 🃏\n\nClique juste ici 👇 pour le récupérer et l'avoir toujours sous la main !";
export const DM_BOUTON = "Clique ici";
export const DM_LIEN = "https://tutoblackjack.com/";
// Réponse publique sous le commentaire : une au hasard à chaque fois (texte seul, sans bouton).
export const PUBLIQUES = [
  "Je te l'ai envoyé ✨ (Regarde dans tes invitations par message)",
  "Regarde tes DM 📩 (Regarde dans tes invitations par message)",
  "Envoyé en message privé 💌 (Regarde dans tes invitations par message)",
  "Fait ! Regarde tes messages ✅ (Regarde dans tes invitations par message)",
];
export const env = (k) => Netlify.env.get(k) || "";
export const hote = (token) => (token.startsWith("IG") ? "graph.instagram.com" : "graph.facebook.com");
export const magasin = () => getStore({ name: "ig-dm", consistency: "strong" });
export const motCle = () => (env("IG_KEYWORD") || "TUTO").toLowerCase();

// Le mot-clé compte quelle que soit la façon de l'écrire : majuscules, accents, espaces, points, emojis,
// seul ou au milieu d'une phrase (« TUTO », « tuto svp », « T.U.T.O », « je veux le tuto »).
export function correspond(texte, mot) {
  return String(texte).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "").includes(mot);
}

async function post(url, token, corps) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(corps) });
  return { ok: r.ok, status: r.status, detail: r.ok ? "" : (await r.text()).slice(0, 300) };
}
export async function lire(chemin, token) {
  const r = await fetch(`https://${hote(token)}/${chemin}`, { headers: { authorization: `Bearer ${token}` } });
  const t = await r.text();
  if (!r.ok) return { ok: false, status: r.status, detail: t.slice(0, 300) };
  try { return { ok: true, data: JSON.parse(t) }; } catch { return { ok: false, status: r.status, detail: "réponse illisible" }; }
}

// Message privé avec bouton ; si Instagram refuse le bouton, même texte avec le lien en clair.
async function envoyerDM(compte, commentaire, token) {
  const texte = env(`IG_DM_TEXT_${compte}`) || env("IG_DM_TEXT") || DM_TEXTE;
  const lien = env(`IG_DM_LINK_${compte}`) || env("IG_DM_LINK") || DM_LIEN;
  const bouton = env("IG_DM_BUTTON") || DM_BOUTON;
  const avecBouton = { recipient: { comment_id: commentaire }, message: { attachment: { type: "template", payload: { template_type: "button", text: texte, buttons: [{ type: "web_url", url: lien, title: bouton }] } } } };
  const simple = { recipient: { comment_id: commentaire }, message: { text: `${texte}\n\n${lien}` } };
  const essais = [];
  for (const cible of [compte, "me"]) {
    const url = `https://${hote(token)}/${cible}/messages`;
    for (const [forme, corps] of [["bouton", avecBouton], ["texte", simple]]) {
      const r = await post(url, token, corps);
      if (r.ok) return { ok: true, forme, cible, essais };
      essais.push(`${cible}/${forme}: ${r.status} ${r.detail}`.slice(0, 260));
    }
  }
  return { ok: false, essais };
}

// Journal des 30 derniers envois (sans nom ni identifiant de personne).
export async function noter(store, ligne) {
  try {
    const j = (await store.get("journal", { type: "json" })) || [];
    j.unshift({ t: new Date().toISOString(), ...ligne });
    await store.setJSON("journal", j.slice(0, 30));
  } catch (e) { console.error("ig: journal", e?.message); }
}

// Traite un commentaire : une seule fois, message privé puis réponse publique.
export async function traiter(store, compte, idCommentaire, source) {
  if (await store.get(`c-${idCommentaire}`)) return false;
  await store.set(`c-${idCommentaire}`, new Date().toISOString());
  const token = env(`IG_TOKEN_${compte}`);
  if (!token) { await noter(store, { source, compte, ok: false, erreur: "pas de jeton pour ce compte" }); return true; }
  const dm = await envoyerDM(compte, idCommentaire, token);
  let pub = "non tentée";
  if (dm.ok) {
    const r = await post(`https://${hote(token)}/${idCommentaire}/replies`, token, { message: PUBLIQUES[Math.floor(Math.random() * PUBLIQUES.length)] });
    pub = r.ok ? "ok" : `${r.status} ${r.detail}`;
  }
  await noter(store, { source, compte, dm, reponse_publique: pub });
  return true;
}
