// Logique pure (aucune dépendance Netlify) : validation des événements,
// agrégation journalière, écriture avec contrôle de version. Testable en local.

export const MAX_BODY = 2000;          // octets max d'une requête
export const MAX_EVENTS = 5;           // événements max par requête
export const MAX_DURATION = 1800;      // secondes max comptées par page vue
const MAX_KEYS = { pages: 300, cta: 60, src: 150 };
const OTHER = '(autre)';
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

const RE_ID = /^[a-z0-9]{6,16}$/;
const RE_PATH = /^\/[A-Za-z0-9/_\-.~%]{0,119}$/;
const RE_CTA = /^[A-Za-z0-9_-]{1,40}$/;
const RE_UTM = /^[a-z0-9_.-]{1,40}$/;
const RE_HOST = /^(?=.{1,60}$)[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const RE_BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|scan|monitor|curl|wget|python|httpclient|okhttp|axios|node-fetch|go-http|java\/|libwww|phantom|puppeteer|playwright|selenium|facebookexternalhit|whatsapp|telegram|discord|embedly|pingdom|uptime|gptbot|claude|perplexity|bytespider|semrush|ahrefs|mj12|dotbot|yandex|baidu|bingpreview/i;

export function isBot(ua) {
  if (typeof ua !== 'string' || ua.length < 20) return true; // UA absent ou trop court
  return RE_BOT.test(ua);
}

// Jour AAAA-MM-JJ, fuseau Europe/Paris.
export function dayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

export function lastDays(n, now = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(new Date(now.getTime() - i * 86400000)));
  return [...new Set(out)];
}

export function clampDays(raw) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 7;
  return Math.min(n, 90);
}

function cleanPath(p) {
  if (typeof p !== 'string') return null;
  let s = p.split('?')[0].split('#')[0];
  if (s.length > 1 && !s.endsWith('/') && !/\.[a-z0-9]{2,5}$/i.test(s)) s += '/';
  s = s.replace(/\/index\.html$/, '/');
  if (!RE_PATH.test(s) || s.includes('..') || s.includes('//')) return null;
  if (s.startsWith('/admin') || s.startsWith('/api/') || s.startsWith('/.netlify')) return null;
  return s;
}

// Valide le corps reçu. Renvoie null (rejet) ou { path, events: [...] } entièrement normalisé.
// Tout champ inconnu est ignoré ; rien d'autre que ces champs ne peut atteindre le stockage.
export function validatePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (typeof body.i !== 'string' || !RE_ID.test(body.i)) return null; // vérifié puis jeté, jamais stocké
  const path = cleanPath(body.p);
  if (!path) return null;
  if (!Array.isArray(body.e) || body.e.length < 1 || body.e.length > MAX_EVENTS) return null;

  const events = [];
  for (const ev of body.e) {
    if (!ev || typeof ev !== 'object' || Array.isArray(ev)) return null;
    switch (ev.t) {
      case 'view': {
        const device = ev.d === 'm' ? 'mobile' : ev.d === 't' ? 'tablette' : ev.d === 'd' ? 'ordinateur' : null;
        if (!device) return null;
        let ref = '';
        if (typeof ev.r === 'string' && ev.r) {
          const r = ev.r.toLowerCase().replace(/^www\./, '');
          if (RE_HOST.test(r)) ref = r;
        }
        let utm = '';
        if (typeof ev.u === 'string' && ev.u) {
          const u = ev.u.toLowerCase();
          if (RE_UTM.test(u) && !FORBIDDEN.has(u)) utm = u;
        }
        events.push({ t: 'view', device, source: utm ? 'utm:' + utm : ref || 'direct', isNew: ev.n === 1 });
        break;
      }
      case 'cta': {
        if (typeof ev.c !== 'string' || !RE_CTA.test(ev.c) || FORBIDDEN.has(ev.c)) return null;
        events.push({ t: 'cta', name: ev.c });
        break;
      }
      case 'leave': {
        if (![0, 25, 50, 75, 100].includes(ev.s)) return null;
        if (typeof ev.d !== 'number' || !Number.isFinite(ev.d) || ev.d < 0) return null;
        events.push({ t: 'leave', scroll: ev.s, seconds: Math.min(Math.round(ev.d), MAX_DURATION) });
        break;
      }
      case 'email':
        events.push({ t: 'email' });
        break;
      default:
        return null; // liste blanche stricte
    }
  }
  return { path, events };
}

export function emptyDay() {
  return {
    v: 1,
    visits: 0,            // entrées sur le site (page vue venant de l'extérieur)
    views: 0,             // pages vues
    clicks: 0,            // clics CTA
    emails: 0,            // formulaires email envoyés
    pages: {},            // chemin -> { v, t, tn, ss, sn, c: {cta: n}, e }
    cta: {},              // nom -> n
    scroll: { 0: 0, 25: 0, 50: 0, 75: 0, 100: 0 },
    src: {},              // source -> visites
    dev: { mobile: 0, tablette: 0, ordinateur: 0 },
  };
}

function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

// Clé bornée : au-delà de `max` clés distinctes, tout part dans « (autre) ».
function slot(map, key, max) {
  if (has(map, key)) return key;
  return Object.keys(map).length >= max ? OTHER : key;
}

function bump(map, key, max, by = 1) {
  const k = slot(map, key, max);
  map[k] = (has(map, k) ? map[k] : 0) + by;
}

function page(day, path) {
  const k = slot(day.pages, path, MAX_KEYS.pages);
  if (!has(day.pages, k)) day.pages[k] = { v: 0, t: 0, tn: 0, ss: 0, sn: 0, c: {}, e: 0 };
  return day.pages[k];
}

// Applique un lot validé à un agrégat journalier (mutation en place, renvoie l'agrégat).
export function applyEvents(day, { path, events }) {
  const d = day && day.v === 1 ? day : emptyDay();
  for (const ev of events) {
    const p = page(d, path);
    if (ev.t === 'view') {
      d.views++; p.v++;
      d.dev[ev.device]++;
      if (ev.isNew) { d.visits++; bump(d.src, ev.source, MAX_KEYS.src); }
    } else if (ev.t === 'cta') {
      d.clicks++;
      bump(d.cta, ev.name, MAX_KEYS.cta);
      bump(p.c, ev.name, MAX_KEYS.cta);
    } else if (ev.t === 'leave') {
      d.scroll[ev.scroll]++;
      p.ss += ev.scroll; p.sn++;
      p.t += ev.seconds; p.tn++;
    } else if (ev.t === 'email') {
      d.emails++; p.e++;
    }
  }
  return d;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Lecture-modification-écriture avec contrôle de version (ETag) :
// l'écriture n'est acceptée que si le blob n'a pas changé depuis la lecture,
// sinon on relit et on recommence (5 essais). Renvoie true si enregistré.
export async function recordBatch(store, key, batch, { tries = 5, wait = sleep } = {}) {
  for (let attempt = 0; attempt < tries; attempt++) {
    const entry = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
    let res;
    if (entry === null) {
      res = await store.setJSON(key, applyEvents(emptyDay(), batch), { onlyIfNew: true });
    } else {
      res = await store.setJSON(key, applyEvents(entry.data, batch), { onlyIfMatch: entry.etag });
    }
    if (res && res.modified) return true;
    await wait(15 + Math.floor(Math.random() * 60 * (attempt + 1)));
  }
  return false;
}

export async function readDays(store, keys) {
  const days = await Promise.all(keys.map(async (date) => {
    const data = await store.get(date, { type: 'json', consistency: 'strong' });
    return { date, data: data && data.v === 1 ? data : null };
  }));
  return days;
}
