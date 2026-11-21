# Vidéos noir et blanc du compte Instagram @tuto_blackjack

Procédure de la tâche quotidienne. Personne n'est devant l'écran : applique-la telle quelle et rends compte à la fin.
Ce compte est différent de @tutoblackjack (Reels courts sur tapis vert, procédure `README.md`) : ne mélange pas les deux.

## Règles fixes (validées par Alex, n'en change rien)

- Compte : Instagram **@tuto_blackjack**, marque Metricool « JUNICASINO », `blogId` **5961876**, fuseau Europe/Paris.
  Cette marque contient aussi le compte X @junicasino : n'y publie JAMAIS rien et ne touche à aucun post X.
  Réseau : uniquement `{"network":"instagram"}`.
- 3 vidéos par jour, aux créneaux **11:15, 16:00 et 20:30** (heure de Paris). Jamais le même sujet deux fois.
- Format : vidéo verticale noir et blanc en motion design, rendue par `make_nb.py` avec le gabarit `nb.html`. Durée de voix : 30 à 45 secondes.
- Voix : ElevenLabs « Noé », `voice_id` `7pDdnNI6PhXmAp0pXFZm`, modèle `eleven_v4`, **aucun effet** (la prise est utilisée telle quelle).
- Musique : Epidemic Sound « Milk » (Dyalla), id `805a29fe-c2c1-4937-aea7-dd61fd21f1f9`, mixée très bas par `make_nb.py`.
- Fin de chaque vidéo, mot pour mot : « Commente « TUTO » sous ce post, et je t'envoie ton tableau de blackjack gratuitement. »
  (l'envoi du message privé est automatique, tu n'as rien à faire).
- Étiquette « contenu généré par IA » d'Instagram : désactivée (`"isAiGenerated": false`).
- Tutoiement, phrases courtes, français simple. Nombres écrits en lettres dans le texte de la voix.

## Les sujets : deux par jour de stratégie, un d'histoire vraie

**Stratégie ou fonctionnement du blackjack** (2 par jour). Un seul point par vidéo, expliqué avec un chiffre.
Les faits doivent venir de `jeux/strategie.js` (stratégie de base : S17, doubler après partage, pas d'abandon) ou de cette liste :
l'assurance coûte environ 7 % ; la stratégie de base ramène l'avantage du casino à environ 0,5 % ; un blackjack payé 6 contre 5 au lieu de 3 contre 2
ajoute environ 1,4 point à l'avantage du casino ; 4 valeurs de cartes sur 13 valent dix ; le croupier saute environ 4 fois sur 10 avec un 5 ou un 6,
environ 1 fois sur 3 avec un 2, environ 1 fois sur 4 avec un 7, environ 1 fois sur 6 avec un As ; rester sur 16 contre 10 perd environ 77 % du temps ;
16 est la pire main ; on partage toujours les As et les 8, jamais les 10 ni les 5 ; on double 11.
Si un chiffre n'est ni dans cette liste ni calculable depuis `strategie.js`, ne l'utilise pas.

**Histoire vraie** (1 par jour) : joueurs, casinos, coups célèbres, origine d'une règle. Avant d'écrire, vérifie chaque chiffre et chaque fait
avec une recherche web sur **deux sources sérieuses** qui concordent. Si tu ne peux pas vérifier, change de sujet. Pas de légende présentée comme vraie.

**Interdits** : promettre ou suggérer un gain, de l'argent facile ou une méthode pour battre le casino ; inventer des gains, des chiffres ou des témoignages ;
présenter le comptage de cartes comme un moyen de gagner ; nommer ou recommander un casino en ligne ; s'adresser aux mineurs ; parler de dettes ou de « se refaire ».

## Étapes

1. `tools/reels/published-nb.json` liste les sujets déjà faits (`id`, `date`, `heure`, `type`). Appelle `getScheduledPosts` (blogId 5961876, d'aujourd'hui 00:00
   à demain 23:59) et ne garde que les posts Instagram. Créneaux à remplir : ceux d'**aujourd'hui encore à plus de 45 minutes** et ceux de **demain**
   qui n'ont pas de post Instagram. S'il n'y en a aucun, passe directement à l'étape 9. Au plus 6 vidéos par exécution.
2. Pour chaque créneau, choisis un sujet neuf (ni le même `id`, ni la même idée qu'un sujet déjà fait) et écris le texte de la voix :
   85 à 125 mots, une accroche forte dans la première phrase, une idée par phrase, puis la phrase de fin imposée.
3. **Voix** : `creative_generate_speech` (texte, `eleven_v4`, voix Noé), un appel par vidéo, sans changer `generations_count`.
   Attends la fin avec `creative_get_flow_run_status`, prends la première prise terminée et télécharge son `content_url` avec curl.
   Ne relance jamais une génération dont tu ne connais pas le résultat sans avoir vérifié qu'aucune prise n'a été créée.
4. **Musique** : une fois par exécution, `DownloadRecording` (Epidemic Sound) avec l'id ci-dessus, format MP3, puis curl.
5. **Caler les temps** : depuis `tools/reels`,
   `python3 -c "import sys; sys.path.insert(0,'.'); from seg import segments,creux; f='voix.mp3'; m,d=segments(f); [print(i,s,[c for c in creux(f,s[0],s[1],seuil=0.08,mini=0.1)] if s[1]-s[0]>2.4 else '') for i,s in enumerate(m)]"`
   donne le début et la fin de chaque morceau de phrase, et les pauses à l'intérieur des morceaux longs. Associe chaque morceau à sa phrase en t'aidant des durées
   (Noé dit environ 6 syllabes par seconde).
6. **Écrire la fiche** : un fichier JSON `{"scenes":[...]}`. Chaque scène a `t` (seconde où elle commence, calée sur le début de sa phrase, la première à 0),
   un `type`, et son contenu. Une scène par phrase ou groupe de phrases courtes ; change de type régulièrement ; mets `"inv": true` (fond blanc) sur 2 ou 3 scènes fortes.
   Les trois fiches de `tools/reels/exemples-nb/` sont des modèles validés : relis-les avant d'écrire.
   - `mots` : `lignes`, liste de lignes. Chaque ligne est `{"t":"texte","d":délai}` avec en option `"p":1` (petite ligne de texte courant, peut être longue),
     `"f":1` (ligne en bloc inversé, pour le mot fort), `"b":1` (barrée), `"max":taille`. Sans `p`, la ligne est en très gros : 14 caractères au plus.
     `d` est le nombre de secondes après le début de la scène où la ligne apparaît : cale-le sur le moment où la voix dit ces mots.
   - `cartes` : `cartes` (par exemple `["A♠","?"]`, `?` = carte face cachée, 3 cartes au plus), `sur` (ligne au-dessus), `leg` (légende) et `ld` (délai de la légende).
   - `chiffre` : `a` (valeur finale), `de` (départ, 0 par défaut), `dec` (décimales), `pre`, `suf`, `sur`, `leg`, `ld`. Le nombre défile pendant 1,2 seconde.
   - `grille` : `cases` (textes), `pleins` (indices des cases remplies), `cols`, `dp` (délai du remplissage), `titre`, `sur`, `leg`.
   - `jetons` : `items` `[{"v":"10 €","l":"ta mise","d":0.05,"sz":taille}]`, `sur`, `leg`, `ld`.
   - `fin` : toujours la dernière scène, `t` = début de « Commente », `t2` = secondes entre « Commente » et « et je t'envoie ».
   Tout le texte à l'écran doit être ce que dit la voix (résumé au besoin), sans faute, avec les apostrophes typographiques « ’ ».
7. **Rendu** : `python3 make_nb.py fiche.json voix.mp3 musique.mp3 sortie.mp4 couverture.jpg`. Ouvre l'image `sortie-controle.jpg` (une vignette par scène) et vérifie :
   aucun texte coupé ou qui déborde, bonnes cartes, bons chiffres, scène de fin complète. Corrige la fiche et relance si besoin. Si une vidéo reste mauvaise, abandonne-la.
8. **Héberger et programmer** : copie la vidéo dans `reels/AAAA-MM-JJ-HHMM-nb-<id>.mp4`, ajoute le sujet à `tools/reels/published-nb.json`, commit et push sur `main`.
   Adresse du média : `https://raw.githubusercontent.com/Magogogogroscul/boisterous-panda-3d581e/main/reels/<fichier>.mp4` (attends 20 secondes après le push).
   Puis `createScheduledPost` avec `blogId` "5961876", la date du créneau, et `info` :
   `{"autoPublish":true,"descendants":[],"draft":false,"firstCommentText":"","hasNotReadNotes":false,"media":["<adresse>"],"mediaAltText":[],"providers":[{"network":"instagram"}],"publicationDate":{"dateTime":"AAAA-MM-JJTHH:MM:00","timezone":"Europe/Paris"},"shortener":false,"smartLinkData":{"ids":[]},"text":"<légende>","instagramData":{"type":"REEL","showReelOnFeed":true,"isAiGenerated":false}}`
   Légende : une question ou une accroche + 🃏, une ligne vide, 2 phrases qui résument, une ligne vide,
   « 💬 Commente TUTO et je t'envoie le tableau complet de la stratégie de base, gratuitement. », une ligne vide, « 18+ · Jouer comporte des risques. », une ligne vide,
   7 hashtags dont #blackjack #blackjackfr #casino #strategieblackjack.
   Si un appel échoue, ne le relance qu'une fois et ne modifie pas le texte pour le faire passer.
9. **Page de suivi** : dans `netlify/data/suivi.json`, mets à jour `maj`, `voix` (`account_get_usage`), et pour le compte `tuto_blackjack` : `etat` = `automatique`,
   `creneaux` = `["11:15","16:00","20:30"]`, `posts` = les posts Instagram renvoyés par `getScheduledPosts` (blogId 5961876, des 30 derniers jours à demain ;
   `quand`, `sujet` court, `statut` `publie` avec son `lien` si PUBLISHED, `erreur` si Metricool signale une erreur, sinon `programme`). Ne touche pas au compte `tutoblackjack`.
   Commit et push.
10. **Compte rendu** court en français : vidéos programmées (sujet, date, heure), crédits voix restants, ce qui a été abandonné et pourquoi, tout ce qui a échoué.

Si un connecteur ne répond pas, si un téléchargement ou un push est refusé, n'essaie pas de contourner : arrête cette étape et dis précisément ce qui a bloqué.
Ne modifie aucun autre fichier du dépôt que `reels/`, `tools/reels/published-nb.json` et `netlify/data/suivi.json`.
