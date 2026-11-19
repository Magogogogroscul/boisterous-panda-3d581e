// Relevé périodique des commentaires Instagram (toutes les 2 minutes).
// Meta n'envoie les commentaires par webhook qu'aux applications validées (accès avancé) ;
// ce relevé lit donc lui-même les commentaires récents des comptes connectés et répond à ceux qui contiennent le mot-clé.
import { env, lire, magasin, motCle, correspond, traiter, noter } from "../lib/ig-core.mjs";

const SEPT_JOURS = 7 * 24 * 3600 * 1000;

export default async () => {
  const store = magasin();
  const mot = motCle();
  const comptes = Object.keys(Netlify.env.toObject()).map((k) => (k.match(/^IG_TOKEN_(\d+)$/) || [])[1]).filter(Boolean);
  const debut = Date.now();
  for (const compte of comptes) {
    const token = env(`IG_TOKEN_${compte}`);
    const etat = (await store.get(`etat-${compte}`, { type: "json" })) || { medias: {}, erreur: "" };
    const medias = await lire(`${compte}/media?fields=id,timestamp,comments_count&limit=12`, token);
    if (!medias.ok) {
      const e = `lecture des publications : ${medias.status} ${medias.detail}`;
      if (etat.erreur !== e) { await noter(store, { source: "releve", compte, ok: false, erreur: e }); etat.erreur = e; await store.setJSON(`etat-${compte}`, etat); }
      continue;
    }
    etat.erreur = "";
    for (const m of medias.data.data || []) {
      if (Date.now() - debut > 20000) break;                              // on reste sous la limite de durée
      const n = m.comments_count || 0;
      if (!n || etat.medias[m.id] === n) continue;                        // rien de nouveau sur cette publication
      const coms = await lire(`${m.id}/comments?fields=id,text,timestamp,from&limit=50`, token);
      if (!coms.ok) { await noter(store, { source: "releve", compte, ok: false, erreur: `lecture des commentaires : ${coms.status} ${coms.detail}` }); continue; }
      for (const c of coms.data.data || []) {
        if (!correspond(c.text || "", mot)) continue;
        if (c.from && String(c.from.id) === compte) continue;             // nos propres commentaires
        if (c.timestamp && Date.now() - new Date(c.timestamp).getTime() > SEPT_JOURS) continue;
        try { await traiter(store, compte, String(c.id), "releve"); } catch (e) { await noter(store, { source: "releve", compte, ok: false, erreur: String(e?.message).slice(0, 200) }); }
      }
      etat.medias[m.id] = n;
    }
    await store.setJSON(`etat-${compte}`, etat);
  }
  await store.setJSON("dernier-releve", { t: new Date().toISOString(), comptes: comptes.length });
  return new Response("ok");
};

export const config = { schedule: "*/2 * * * *" };
