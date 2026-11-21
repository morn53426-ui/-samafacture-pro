# Vidéo de présentation — Sunupilot

## Master de présentation avec personnes

- Master de référence : MP4 H.264, Full HD 1920 × 1080, 24 i/s, AAC stéréo 48 kHz, 45,4 secondes.
- Export mobile : MP4 H.264, 1280 × 720, AAC stéréo.
- Sept séquences : ouverture humaine, factures/devis, équipe au travail, clients, rapports, interface mobile et conclusion humaine.
- Transitions fondues et mouvements de caméra numériques discrets.
- Bande instrumentale originale.
- Narration française provisoire synchronisée (voix de synthèse hors ligne) pour validation du texte et du rythme.
- Sous-titres français WebVTT synchronisés sur la narration.

## Identité de marque

Le nom visible est exclusivement **Sunupilot**. Le lecteur et la présentation utilisent l'emblème officiel conservé dans `public/images/icon-192.png` et la palette vert baobab / indigo.

## Personnes et visuels

Les personnes visibles sont des visuels générés pour illustrer des situations professionnelles. Elles ne représentent pas des clients, employés ou ambassadeurs réels.

Les vues applicatives sont des maquettes de démonstration construites à partir des fonctionnalités documentées, pas des captures d'une session réelle.

## Périmètre produit

Factures et devis, clients, produits, suivi des règlements reçus, dépenses, rapports et interface web responsive. Aucun paiement automatique ni abonnement payant n'est présenté comme disponible.

## Script de narration provisoire

Au quotidien, vous gérez vos clients, vos documents et bien plus encore.

Avec Sunupilot, créez et suivez vos factures et vos devis en toute simplicité.

Centralisez les informations de vos clients et retrouvez votre catalogue au même endroit.

Enregistrez les règlements reçus pour garder une trace claire de vos encaissements.

Suivez vos dépenses et consultez des rapports pour mieux comprendre votre activité.

Retrouvez vos outils essentiels depuis votre ordinateur, votre tablette ou votre téléphone.

Sunupilot. Votre entreprise, mieux pilotée.

## Qualité audio — point à finaliser

La piste parlée fournie pour cette étape est une **voix de synthèse française provisoire** (générée hors ligne), destinée à vérifier le minutage et la formulation. Elle ne doit pas être considérée comme la voix off studio définitive. Pour la version publicitaire finale, remplacer cette piste par un enregistrement humain professionnel, en gardant le script et les repères WebVTT.

## Intégration web

Le lecteur HTML5 de la page d'accueil attend :
`public/videos/sunupilot-presentation.mp4`

Les sous-titres se chargent depuis :
`public/videos/sunupilot-presentation-fr.vtt`

La miniature SVG déjà ajoutée est la couverture de secours. Le MP4 master avec narration provisoire et sa variante mobile sont livrés séparément ; le connecteur GitHub disponible ici ne permet pas de téléverser le binaire vidéo dans cette session.

Avant fusion, ajouter le master à l'emplacement indiqué et tester lecture, piste audio, sous-titres, plein écran, chargement mobile et fallback. Ne pas fusionner avant cette recette.
