# Reels @tutoblackjack — procédure de la tâche quotidienne

Cette procédure est suivie par une tâche planifiée, sans personne devant l'écran. Elle produit des Reels Instagram
au format validé par Alex et les programme dans Metricool. Ne change ni le format, ni la voix, ni le décor.

## Règles fixes

- Compte : marque Metricool **tutoblackjack**, `blogId` **6734454** (Instagram @tutoblackjack). Jamais une autre marque.
- Créneaux, heure de Paris : **10:00, 12:30 et 18:00**, tous les jours. Trois Reels par jour, jamais deux fois la même situation.
- Voix : ElevenLabs, voix **Noé – Content Creator**, `voice_id` `7pDdnNI6PhXmAp0pXFZm`, modèle `eleven_v4`.
  La voix est utilisée brute : aucun effet, aucun filtre, aucun découpage, aucun changement de vitesse ou de volume.
- Musique : Epidemic Sound, « Milk » (Dyalla), id `805a29fe-c2c1-4937-aea7-dd61fd21f1f9`, mixée très bas par `make_reel.py`.
- Étiquette « contenu généré par IA » d'Instagram : **désactivée** (`isAiGenerated: false`), demande d'Alex.
- Fin de chaque Reel : « Commente TUTO sous ce post, et je t'envoie ton tableau de blackjack gratuitement. »
  L'envoi du message privé est géré par un autre outil, ne t'en occupe pas.
- Aucune promesse de gain. Aucun pourcentage inventé : seuls les faits de la liste ci-dessous, ou des formulations sans chiffre.
- Ne publie rien d'autre que ces Reels. Ne réponds ni aux commentaires ni aux messages.

## Faits autorisés (ordres de grandeur, toujours avec « environ »)

- Rester sur 16 contre 10 perd environ 77 % du temps.
- Le croupier saute environ 4 fois sur 10 quand il montre un 4, un 5 ou un 6 ; environ 1 fois sur 3 avec un 2 ou un 3 ;
  environ 1 fois sur 4 avec un 7, un 8 ou un 9 ; environ 1 fois sur 5 avec un 10.
- Près d'une carte sur trois vaut 10.
- L'assurance coûte environ 7 % de la mise sur la durée.
- La stratégie de base ramène l'avantage du casino à environ 0,5 %.
- 16 est la pire main du blackjack.

## Étapes

1. **Préparer.** Dans `tools/reels/` : `npm install --no-audit --no-fund @fontsource/outfit` si `node_modules` est absent.
   Vérifie `python3 -c "import playwright, numpy"` et `ffmpeg -version` ; installe ce qui manque (`pip install --break-system-packages playwright numpy`).
2. **Voir ce qui est déjà programmé.** `getScheduledPosts` sur `6734454` de maintenant à J+3 (fuseau Europe/Paris).
   Liste les créneaux libres parmi 10:00, 12:30 et 18:00 pour **demain (J+1) et après-demain (J+2)**, plus ceux d'aujourd'hui
   s'ils sont à plus de 3 heures. Remplis les créneaux libres dans l'ordre chronologique, **5 Reels au maximum par exécution**.
   S'il n'y a aucun créneau libre, ne fais rien et dis-le.
3. **Choisir les situations.** `node situations.js libres` donne les situations jamais utilisées (elles viennent de
   `/jeux/strategie.js`, la source de vérité du site). Choisis-en une par créneau, en variant les types (dure, souple, paire)
   et les réponses (tirer, rester, doubler, partager), et en privilégiant les mains où les joueurs se trompent souvent.
   `node situations.js get <id>` donne les cartes, la réponse et une explication de référence. La réponse du Reel est
   **obligatoirement** le champ `reponse` : ne la décide jamais toi-même.
4. **Écrire le texte de la voix**, sur ce modèle exact (nombres en toutes lettres, phrases courtes) :

   > Onze contre six. Tu fais quoi ? Trois. Deux. Un. Tu doubles ! Onze, c'est la meilleure main pour doubler. Et avec un six, le croupier saute environ quatre fois sur dix. Commente « TUTO » sous ce post, et je t'envoie ton tableau de blackjack gratuitement.

   Structure : accroche (« X contre Y. ») · « Tu fais quoi ? » · « Trois. Deux. Un. » · réponse (« Tu tires ! », « Tu restes ! »,
   « Tu doubles ! », « Tu partages ! ») · deux phrases d'explication courtes · la phrase de fin, mot pour mot.
5. **Générer la voix.** `creative_generate_speech` (ElevenLabs) avec le texte, `voice_id` et `model_id` ci-dessus. Un seul appel
   par Reel : ne relance jamais un appel dont le résultat est inconnu sans avoir d'abord vérifié qu'aucune prise n'a été créée.
   Récupère l'adresse du fichier (`creative_get_flow_run_status` avec les `session_ids`), prends la première prise et
   télécharge-la avec `curl` (domaine `elevenlabsusercontent.com`).
6. **Télécharger la musique** une fois par exécution : `DownloadRecording` (Epidemic Sound) avec l'id ci-dessus, format MP3,
   piste FULL, puis `curl`.
7. **Caler les temps sur la voix.** `python3 -c "import sys; sys.path.insert(0,'.'); from seg import segments; m,d=segments('voix.mp3'); [print(i,s) for i,s in enumerate(m)]"`
   liste les phrases repérées par les silences (début, fin en secondes). Associe-les au texte dans l'ordre :
   accroche · « Tu fais quoi ? » · « Trois » · « Deux » · « Un » · réponse · explication 1 · explication 2 · « Commente TUTO sous ce post » · « et je t'envoie… ».
   Les trois chiffres sont trois segments très courts. Si deux phrases sont fusionnées dans un même segment, trouve la pause
   avec `creux(fichier, debut, fin)` (prends la plus longue, située au bon endroit du texte). Les temps à fournir sont les **débuts** :
   `h2` (« Tu fais quoi ? »), `n1`, `n2`, `n3` (Trois, Deux, Un), `ans` (réponse), `ex1`, `ex2`, `end` (« Commente »), `e3` (« et je t'envoie »).
   Ils doivent être strictement croissants. Si le nombre de segments rend l'association douteuse, régénère **une** nouvelle prise.
8. **Écrire la fiche** `fiche.json` :

   ```json
   {"id": "dure-11-contre-6",
    "fiche": {"hook": "<span class=\"gold\">11</span> contre <span class=\"gold\">6</span>", "dval": "6", "pval": "11",
      "dealer": ["6", "d"], "player": [["9", "c"], ["2", "h"]],
      "choices": ["Tirer", "Rester", "Doubler"], "answer": "DOUBLER", "move": "D",
      "ex1": "11, c’est <span class=\"hl\">la meilleure main</span><br>pour doubler.",
      "ex2": "Avec un 6, le croupier saute<br><span class=\"hg\">environ 4 fois sur 10</span>."},
    "temps": {"h2": 1.18, "n1": 1.98, "n2": 2.62, "n3": 3.4, "ans": 3.9, "ex1": 4.7, "ex2": 6.57, "end": 9.7, "e3": 11.26}}
   ```

   - `dealer` et `player` : recopie `fiche_cartes` de la situation. `dval` : carte du croupier (« As » pour un As). `pval` : champ `pval`.
   - `hook` : la main en chiffres, nombres en `<span class="gold">` (« 16 contre 10 », « 8-8 contre 10 », « As-7 contre 9 »).
   - `choices` : Tirer, Rester, Doubler, et Partager en plus si la main est une paire.
   - `answer` : champ `reponse` ; `move` : champ `coup` (T, R, D ou P).
   - `ex1`, `ex2` : le texte dit par la voix, en deux lignes au plus chacune (`<br>`), avec un passage clé en `<span class="hl">` (jaune)
     ou `<span class="hg">` (vert). Texte à l'écran et voix doivent dire la même chose.
9. **Rendre.** `python3 make_reel.py fiche.json voix.mp3 musique.mp3 AAAA-MM-JJ-HHMM-<id>.mp4 AAAA-MM-JJ-HHMM-<id>.jpg`.
   Le script produit aussi `…-controle.jpg` : **regarde cette planche** (outil Read). Vérifie : bonnes cartes, bonne réponse,
   texte non coupé, pas de chevauchement, fin « Commente TUTO » complète. Corrige et relance si quelque chose cloche.
   Si un Reel ne peut pas être rendu proprement, abandonne-le et passe au suivant.
10. **Héberger.** Copie le `.mp4` dans `reels/` à la racine du dépôt (pas la planche ni la couverture), supprime de `reels/` les `.mp4` et `.jpg`
    de plus de 10 jours, ajoute chaque Reel à `tools/reels/published.json` (`id`, `date`, `heure`, `fichier`), puis commit et push sur `main`.
    Attends le déploiement Netlify (1 à 2 minutes) et vérifie avec `curl -I https://tutoblackjack.com/reels/<fichier>.mp4` que la réponse est 200.
    Si la réponse n'est toujours pas 200 après 4 minutes, le déploiement Netlify est en retard ou bloqué : utilise alors comme adresse du média
    `https://raw.githubusercontent.com/Magogogogroscul/boisterous-panda-3d581e/main/reels/<fichier>.mp4` (le dépôt est public, Metricool recopie le fichier)
    et signale le blocage Netlify dans le compte rendu.
11. **Programmer.** `createScheduledPost` (Metricool), un appel par Reel :
    `blogId` 6734454, date et `publicationDate` au créneau choisi (fuseau `Europe/Paris`), `providers` `[{"network":"instagram"}]`,
    `media` `["https://tutoblackjack.com/reels/<fichier>.mp4"]`, `autoPublish` true, `draft` false,
    `instagramData` `{"type":"REEL","showReelOnFeed":true,"isAiGenerated":false}`.
    Légende : une accroche en question sur la première ligne, deux phrases qui donnent la réponse et la raison, la ligne
    « 💬 Commente TUTO et je t'envoie le tableau complet de la stratégie de base, gratuitement. », la ligne
    « 18+ · Jouer comporte des risques. », puis 6 à 8 hashtags français (#blackjack #strategieblackjack #blackjackfr #casino #jeudecartes #tutoblackjack …).
    Vérifie ensuite avec `getScheduledPosts` que chaque Reel apparaît bien au bon créneau.
11 bis. **Mettre à jour la page de suivi** `netlify/data/suivi.json` (elle alimente tutoblackjack.com/admin/suivi/), puis commit et push :
    - `maj` : date et heure de Paris au format ISO ;
    - `voix` : `utilises`, `limite` et `reset` (date AAAA-MM-JJ) lus avec `account_get_usage` (ElevenLabs) ;
    - `comptes[].posts` du compte concerné : une entrée par Reel renvoyé par `getScheduledPosts` depuis 30 jours
      (`quand` AAAA-MM-JJTHH:MM, `sujet` court, `statut` `publie` si le statut Metricool est PUBLISHED avec son `lien` public,
      `erreur` si Metricool signale une erreur, sinon `programme`). Garde les entrées plus anciennes déjà marquées `publie`, 60 au maximum par compte.
    Ne touche pas aux autres champs ni aux autres comptes.
12. **Rendre compte** en français, en quelques lignes : Reels programmés (situation, date, heure), Reels abandonnés et pourquoi,
    crédits ElevenLabs utilisés si connus, et tout ce qui a échoué. Si une étape bloque (connecteur injoignable, téléchargement refusé,
    push refusé), arrête-toi proprement, ne contourne rien, et dis exactement ce qui a bloqué.
