/* Mesure d'audience maison — sans cookie, sans stockage, sans empreinte. Statistiques agrégées uniquement. */
(function () {
  var n = navigator, d = document, w = window, L = location;
  if (n.doNotTrack === '1' || w.doNotTrack === '1' || n.globalPrivacyControl || n.webdriver || !n.sendBeacon) return;
  if (L.pathname.indexOf('/admin') === 0) return;

  // Identifiant de visite : aléatoire, en mémoire de page seulement (perdu au rechargement).
  var id = Math.random().toString(36).slice(2, 12);
  var path = L.pathname, sent = false, maxScroll = 0, visible = 0, since = Date.now();

  function send(events) {
    try { n.sendBeacon('/api/t', JSON.stringify({ i: id, p: path, e: events })); } catch (e) {}
  }

  // Page vue
  var ref = '';
  try { if (d.referrer) ref = new URL(d.referrer).hostname.replace(/^www\./, ''); } catch (e) {}
  var own = L.hostname.replace(/^www\./, '');
  var utm = '';
  try { utm = (new URLSearchParams(L.search).get('utm_source') || '').slice(0, 40); } catch (e) {}
  var sw = w.innerWidth || screen.width || 0;
  send([{
    t: 'view',
    r: ref === own ? '' : ref,
    d: sw < 768 ? 'm' : sw < 1100 ? 't' : 'd',
    u: utm,
    n: ref !== own || utm ? 1 : 0
  }]);

  // Clics sur les CTA
  d.addEventListener('click', function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-cta]') : null;
    if (el) send([{ t: 'cta', c: String(el.getAttribute('data-cta') || '').slice(0, 40) }]);
  }, true);

  // Envoi d'un formulaire contenant un champ email (jamais l'adresse)
  d.addEventListener('submit', function (ev) {
    var f = ev.target;
    if (f && f.querySelector && f.querySelector('input[type=email]')) send([{ t: 'email' }]);
  }, true);

  // Profondeur de scroll (paliers 25/50/75/100)
  function onScroll() {
    var e = d.documentElement;
    var total = e.scrollHeight - w.innerHeight;
    var pct = total <= 0 ? 100 : (w.pageYOffset || e.scrollTop) / total * 100;
    var step = pct >= 98 ? 100 : pct >= 75 ? 75 : pct >= 50 ? 50 : pct >= 25 ? 25 : 0;
    if (step > maxScroll) maxScroll = step;
  }
  w.addEventListener('scroll', onScroll, { passive: true });

  // Temps passé (temps visible uniquement), envoyé une seule fois à la sortie
  function leave() {
    if (sent) return;
    sent = true;
    onScroll();
    if (d.visibilityState !== 'hidden') visible += Date.now() - since;
    send([{ t: 'leave', s: maxScroll, d: Math.round(visible / 1000) }]);
  }
  d.addEventListener('visibilitychange', function () {
    if (d.visibilityState === 'hidden') { visible += Date.now() - since; leave(); }
    else since = Date.now();
  });
  w.addEventListener('pagehide', leave);
})();
