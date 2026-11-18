#!/usr/bin/env node
// Liste des situations de blackjack utilisables pour un Reel, avec le bon coup tire de /jeux/strategie.js
// (source unique : 4 a 8 jeux, croupier reste sur 17 souple, doublement apres partage, pas d'abandon).
//   node situations.js list            -> toutes les situations (JSON)
//   node situations.js libres          -> celles qui ne sont pas encore dans published.json
//   node situations.js get <id>        -> une situation
const fs = require('fs'), path = require('path');
const S = require(path.join(__dirname, '..', '..', 'jeux', 'strategie.js'));
const UP = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
const SUITS = ['s', 'h', 'd', 'c'];
const suit = (k) => SUITS[Math.abs(k) % 4];
const nom = { T: 'TIRER', R: 'RESTER', D: 'DOUBLER', P: 'PARTAGER' };
function build() {
  const out = [];
  const add = (id, type, cartes, up, dit, pval) => {
    const c = S.conseil(cartes, up);
    const i = out.length;
    out.push({
      id, type, croupier: up, main: cartes, dit, pval,
      coup: c.code, reponse: nom[c.code], explication_source: c.explication,
      fiche_cartes: { dealer: [up, suit(i)], player: [[cartes[0], suit(i + 1)], [cartes[1], suit(i + 3)]] },
    });
  };
  for (let t = 8; t <= 17; t++) for (const up of UP) {
    let a = Math.min(10, t - 2), b = t - a;
    if (a === b) { a -= 1; b += 1; }
    if (b > 10) { b = 10; a = t - 10; }
    add(`dure-${t}-contre-${up}`, 'dure', [String(a), String(b)], up, `${t} contre ${up === 'A' ? 'As' : up}`, String(t));
  }
  for (let k = 2; k <= 8; k++) for (const up of UP)
    add(`souple-as-${k}-contre-${up}`, 'souple', ['A', String(k)], up, `As ${k} contre ${up === 'A' ? 'As' : up}`, `As + ${k}`);
  for (const v of ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']) for (const up of UP)
    add(`paire-${v}-contre-${up}`, 'paire', [v, v], up, `Paire de ${v === 'A' ? 'As' : v} contre ${up === 'A' ? 'As' : up}`, `${v} + ${v}`);
  return out;
}
const all = build();
const cmd = process.argv[2] || 'list';
const pubFile = path.join(__dirname, 'published.json');
const pub = fs.existsSync(pubFile) ? JSON.parse(fs.readFileSync(pubFile, 'utf8')) : [];
const used = new Set(pub.map((p) => p.id));
if (cmd === 'list') console.log(JSON.stringify(all));
else if (cmd === 'libres') console.log(JSON.stringify(all.filter((s) => !used.has(s.id)).map((s) => ({ id: s.id, dit: s.dit, reponse: s.reponse }))));
else if (cmd === 'get') { const s = all.find((x) => x.id === process.argv[3]); if (!s) { console.error('inconnu'); process.exit(1); } console.log(JSON.stringify(s, null, 1)); }
else if (cmd === 'count') console.log(all.length, 'situations,', all.filter((s) => !used.has(s.id)).length, 'libres');
