/*!
 * Stratégie de base du blackjack — tutoblackjack.com
 * Règles couvertes : 4 à 8 jeux, le croupier reste sur 17 souple (S17),
 * doublement après partage autorisé (DAS), pas d'abandon.
 * Source unique utilisée par /jeux/blackjack/, /jeux/entrainement-strategie/
 * et /jeux/quiz-blackjack/.
 *
 * Codes : T = tirer, R = rester, D = doubler (sinon tirer),
 *         d = doubler (sinon rester), P = partager, - = ne pas partager.
 * Colonnes : carte visible du croupier 2 3 4 5 6 7 8 9 10 As.
 */
(function (root) {
  'use strict';

  //            2345678910A
  var DURES = {
    4:  'TTTTTTTTTT',
    5:  'TTTTTTTTTT',
    6:  'TTTTTTTTTT',
    7:  'TTTTTTTTTT',
    8:  'TTTTTTTTTT',
    9:  'TDDDDTTTTT',
    10: 'DDDDDDDDTT',
    11: 'DDDDDDDDDT',
    12: 'TTRRRTTTTT',
    13: 'RRRRRTTTTT',
    14: 'RRRRRTTTTT',
    15: 'RRRRRTTTTT',
    16: 'RRRRRTTTTT',
    17: 'RRRRRRRRRR',
    18: 'RRRRRRRRRR',
    19: 'RRRRRRRRRR',
    20: 'RRRRRRRRRR',
    21: 'RRRRRRRRRR'
  };

  // Clé = total souple (As compté 11). 12 = As-As quand le partage est impossible.
  var SOUPLES = {
    12: 'TTTTTTTTTT',
    13: 'TTTDDTTTTT',
    14: 'TTTDDTTTTT',
    15: 'TTDDDTTTTT',
    16: 'TTDDDTTTTT',
    17: 'TDDDDTTTTT',
    18: 'RddddRRTTT',
    19: 'RRRRRRRRRR',
    20: 'RRRRRRRRRR',
    21: 'RRRRRRRRRR'
  };

  // Clé = valeur d'une carte de la paire (11 = As). '-' : jouer le total.
  var PAIRES = {
    2:  'PPPPPP----',
    3:  'PPPPPP----',
    4:  '---PP-----',
    5:  '----------',
    6:  'PPPPP-----',
    7:  'PPPPPP----',
    8:  'PPPPPPPPPP',
    9:  'PPPPP-PP--',
    10: '----------',
    11: 'PPPPPPPPPP'
  };

  var LIBELLES = { T: 'Tirer', R: 'Rester', D: 'Doubler', P: 'Partager' };

  /** Valeur d'une carte : accepte 2-11, 1, 'A', 'J', 'Q', 'K', 'V', 'D', 'R', '10'. As = 11. */
  function valeur(c) {
    if (c && typeof c === 'object') c = c.rang !== undefined ? c.rang : c.v;
    if (c === 'A' || c === 1 || c === 11 || c === '1' || c === '11') return 11;
    if (c === 'J' || c === 'Q' || c === 'K' || c === 'V' || c === 'D' || c === 'R') return 10;
    var n = parseInt(c, 10);
    if (!(n >= 2 && n <= 10)) throw new Error('Carte invalide : ' + c);
    return n;
  }

  /** Total d'une main et indication « souple » (un As compte encore 11). */
  function total(cartes) {
    var t = 0, as = 0, i, v;
    for (i = 0; i < cartes.length; i++) {
      v = valeur(cartes[i]);
      t += v;
      if (v === 11) as++;
    }
    while (t > 21 && as > 0) { t -= 10; as--; }
    return { total: t, souple: as > 0 };
  }

  function colonne(croupier) {
    var v = valeur(croupier);
    return v === 11 ? 9 : v - 2;
  }

  function nomCroupier(croupier) {
    var v = valeur(croupier);
    return v === 11 ? 'As' : String(v);
  }

  /** Description courte d'une main : « Paire de 8 », « As-7 (18 souple) », « 16 dur ». */
  function decrire(cartes) {
    var info = total(cartes), a, b;
    if (cartes.length === 2) {
      a = valeur(cartes[0]); b = valeur(cartes[1]);
      if (a === b) return a === 11 ? 'Paire d\'As' : 'Paire de ' + a;
      if (info.souple) return 'As-' + (info.total - 11) + ' (' + info.total + ' souple)';
    }
    return info.total + (info.souple ? ' souple' : ' dur');
  }

  function expliquerDure(t, up, code) {
    var c = nomCroupier(up), v = valeur(up);
    if (t <= 8) return 'Avec ' + t + ', tu ne peux pas sauter et la main est trop faible pour doubler : tire.';
    if (t === 9) {
      if (code === 'D') return '9 contre ' + c + ' : le croupier est faible (3 à 6), double pour en profiter.';
      if (v === 2) return '9 contre 2 : le croupier n\'est pas assez faible pour doubler, tire simplement.';
      return '9 contre ' + c + ' : le croupier est trop fort pour doubler, tire.';
    }
    if (t === 10) {
      if (code === 'D') return '10 contre ' + c + ' : double, une carte à 10 points te donne 20 et tu pars devant le croupier.';
      return '10 contre ' + c + ' : le croupier est aussi fort que toi, ne double pas, tire.';
    }
    if (t === 11) {
      if (code === 'D') return '11 contre ' + c + ' : la meilleure main pour doubler, près d\'une carte sur trois vaut 10.';
      return '11 contre As : quand le croupier reste sur 17 souple, on tire sans doubler.';
    }
    if (t === 12) {
      if (code === 'R') return '12 contre ' + c + ' : le croupier est au plus faible (4 à 6), reste et laisse-le sauter.';
      if (v <= 3) return '12 contre ' + c + ' : exception à retenir, le croupier n\'est pas assez faible, tire.';
      return '12 contre ' + c + ' : le croupier a une carte forte, tire.';
    }
    if (t <= 16) {
      if (code === 'R') return t + ' contre ' + c + ' : le croupier a une carte faible (2 à 6), reste et laisse-lui le risque de sauter.';
      return t + ' contre ' + c + ' : le croupier finit souvent à 17 ou plus. Tirer est risqué, mais rester perd encore plus souvent.';
    }
    return t + ' dur : reste toujours, le risque de sauter est trop grand.';
  }

  function expliquerSouple(t, up, code, deuxCartes) {
    var c = nomCroupier(up);
    var nom = deuxCartes ? 'As-' + (t - 11) : t + ' souple';
    if (t >= 19) return t + ' souple : main très forte, reste.';
    if (t === 18) {
      if (code === 'D') return nom + ' contre ' + c + ' : le croupier est faible, double pour en profiter (si tu ne peux pas doubler, reste).';
      if (code === 'R') return nom + ' contre ' + c + ' : 18 suffit face à cette carte, reste.';
      return nom + ' contre ' + c + ' : 18 est en retard face à une carte forte. Tire pour améliorer, l\'As te protège.';
    }
    if (code === 'D') return nom + ' contre ' + c + ' : main souple face à un croupier faible, double. Une seule carte ne peut pas te faire sauter.';
    return nom + ' contre ' + c + ' : une carte ne peut pas te faire sauter et ' + t + ' souple ne suffit pas, tire.';
  }

  function expliquerPaire(p, up, code, t) {
    var c = nomCroupier(up);
    if (p === 11) return 'Paire d\'As : partage toujours. Deux mains qui partent de 11 valent bien mieux qu\'un 12 souple.';
    if (p === 8) return 'Paire de 8 : partage toujours. 16 est la pire main du jeu, deux mains qui partent de 8 font mieux.';
    if (p === 10) return 'Paire de 10 : ne partage jamais, 20 est déjà une main presque gagnante. Reste.';
    if (p === 5) return 'Paire de 5 : ne partage jamais, joue-la comme un 10 dur. ' + expliquerDure(10, up, code);
    if (p === 9) {
      if (code === 'P') return 'Paire de 9 contre ' + c + ' : partage, deux mains qui partent de 9 rapportent plus qu\'un 18.';
      if (valeur(up) === 7) return 'Paire de 9 contre 7 : reste, ton 18 bat le 17 que le croupier vise.';
      return 'Paire de 9 contre ' + c + ' : le croupier est trop fort pour partager, reste sur 18.';
    }
    if (p === 4) {
      if (code === 'P') return 'Paire de 4 contre ' + c + ' : le croupier est au plus faible, partage (tu peux doubler après le partage).';
      return 'Paire de 4 contre ' + c + ' : ne partage pas, joue un 8 dur et tire.';
    }
    if (code === 'P') return 'Paire de ' + p + ' contre ' + c + ' : le croupier est faible, partage pour jouer deux mains contre lui.';
    return 'Paire de ' + p + ' contre ' + c + ' : le croupier est trop fort pour partager, joue ' + t + ' dur et tire.';
  }

  /**
   * Coup de la stratégie de base.
   * @param {Array} cartes   cartes du joueur (valeurs ou rangs)
   * @param {*} croupier     carte visible du croupier
   * @param {Object} [opts]  { peutDoubler: bool, peutPartager: bool } — par défaut :
   *                         doubler et partager possibles seulement avec deux cartes.
   * @returns {{code:string, ideal:string, libelle:string, type:string, total:number, main:string, explication:string}}
   *          code  = coup à jouer compte tenu des options disponibles
   *          ideal = coup du tableau si toutes les options étaient disponibles
   */
  function conseil(cartes, croupier, opts) {
    opts = opts || {};
    var deux = cartes.length === 2;
    var peutDoubler = opts.peutDoubler === undefined ? deux : !!opts.peutDoubler;
    var peutPartager = opts.peutPartager === undefined ? deux : !!opts.peutPartager;
    var info = total(cartes);
    var col = colonne(croupier);
    var estPaire = deux && valeur(cartes[0]) === valeur(cartes[1]);
    var p = estPaire ? valeur(cartes[0]) : 0;
    var type, brut, ideal, code, explication;

    function lireTotal() {
      return (info.souple ? SOUPLES : DURES)[info.total].charAt(col);
    }
    function resoudre(b, doubler) {
      if (b === 'D') return doubler ? 'D' : 'T';
      if (b === 'd') return doubler ? 'D' : 'R';
      return b;
    }

    if (info.total > 21) throw new Error('Main déjà sautée');

    if (estPaire && PAIRES[p].charAt(col) === 'P') {
      type = 'paire';
      ideal = 'P';
      code = peutPartager ? 'P' : resoudre(lireTotal(), peutDoubler);
    } else {
      type = estPaire ? 'paire' : (info.souple ? 'souple' : 'dure');
      brut = lireTotal();
      ideal = resoudre(brut, true);
      code = resoudre(brut, peutDoubler);
    }

    if (type === 'paire') explication = expliquerPaire(p, croupier, ideal, info.total);
    else if (type === 'souple') explication = expliquerSouple(info.total, croupier, ideal, deux);
    else explication = expliquerDure(info.total, croupier, ideal);

    if (code !== ideal) {
      explication += ' ' + LIBELLES[ideal] + ' n\'est pas possible ici : ' + (code === 'T' ? 'tire' : code === 'R' ? 'reste' : LIBELLES[code].toLowerCase()) + '.';
    }

    return {
      code: code,
      ideal: ideal,
      libelle: LIBELLES[code],
      type: type,
      total: info.total,
      main: decrire(cartes),
      explication: explication
    };
  }

  var api = {
    DURES: DURES, SOUPLES: SOUPLES, PAIRES: PAIRES, LIBELLES: LIBELLES,
    valeur: valeur, total: total, decrire: decrire, conseil: conseil,
    nomCroupier: nomCroupier
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BJStrategy = api;
})(typeof window !== 'undefined' ? window : globalThis);
