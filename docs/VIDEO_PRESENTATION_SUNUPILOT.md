# Vidéo de présentation — Sunupilot

## Export de montage professionnel

- Master : MP4 H.264, 1920 × 1080, 24 i/s, AAC stéréo 48 kHz, durée 32,75 secondes.
- Export mobile : MP4 H.264, 1280 × 720, AAC stéréo, cadrage horizontal 16:9 pour préserver simultanément les titres et les démonstrations d'interface.
- Miniature : visuel 16:9.
- Sous-titres : français WebVTT.
- Musique : bande instrumentale originale, composée spécialement pour cette présentation.
- Montage : six séquences, fondus de 0,65 seconde, mouvement de caméra discret, fondu d'ouverture et de fermeture.

## Identité de marque

Le nom affiché est exclusivement **Sunupilot**. La direction visuelle respecte la palette vert baobab et indigo et reprend l'emblème arbre vert / courbe indigo de la marque. Le fichier logo original du dépôt `public/images/icon-192.png` reste la source de vérité pour la page web.

## Périmètre présenté

La vidéo se limite aux fonctionnalités documentées dans le dépôt : factures et devis, clients, produits, suivi des règlements reçus, dépenses, rapports et interface web responsive. Elle ne promet ni paiement automatique ni souscription payante.

## Transparence des visuels

Les fenêtres applicatives sont des compositions de démonstration construites à partir du périmètre documenté, identifiées « MODE DÉMONSTRATION ». Elles ne sont pas des captures d'écran d'une session réelle. Il faut les remplacer par des captures réelles si la publicité doit démontrer les gestes exacts dans l'application en production.

## Audio et narration

Le master contient une bande instrumentale originale, mais **aucune voix off parlée**. Le fichier WebVTT fournit les sous-titres français ; un script de narration peut être enregistré avec une voix humaine professionnelle pour une version publicitaire parlée.

## Intégration de la vidéo

Le lecteur HTML5 de la page d'accueil attend :
`public/videos/sunupilot-presentation.mp4`

Les sous-titres sont chargés depuis :
`public/videos/sunupilot-presentation-fr.vtt`

La miniature utilisée par le lecteur est :
`public/images/sunupilot-presentation-poster.svg`

Le MP4 master a été exporté hors du dépôt car l'intégration GitHub disponible dans cette session ne permet pas le téléversement direct du fichier binaire. Il doit être ajouté à l'emplacement indiqué avant le déploiement. Tant qu'il n'est pas présent, le composant de présentation de secours reste visible.

## Recette obligatoire avant fusion

- Ajouter le MP4 à `public/videos/sunupilot-presentation.mp4`.
- Tester la lecture, le volume, les sous-titres et le plein écran sur ordinateur et iPhone/Android.
- Vérifier le chargement différé et le fallback si la vidéo échoue.
- Confirmer que l'interface de présentation reste accessible et responsive.
- Ne pas fusionner avant ces vérifications.
