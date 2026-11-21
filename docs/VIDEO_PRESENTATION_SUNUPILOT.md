# Vidéo de présentation — Sunupilot

## Dernière version du montage

- Master hors dépôt : `sunupilot-presentation-repo-faithful.mp4`, H.264 Full HD 1920 × 1080, 24 i/s, AAC stéréo 48 kHz, 45,4 secondes.
- Export mobile horizontal : `sunupilot-presentation-repo-faithful-mobile.mp4`, H.264 1280 × 720.
- Sept scènes alternant personnes générées et écrans de gestion.
- Transitions fondues, très léger mouvement de caméra, musique instrumentale originale.
- Sous-titres français WebVTT.
- Piste parlée française de synthèse provisoire pour vérifier le timing et le script ; pas une voix humaine de studio.

## Écrans fondés sur le code source

Les écrans de démonstration ont été reconstruits à partir des libellés et structures des pages réelles :
- `public/factures.html` : titre Facturation, indicateurs Chiffre d’affaires / Factures payées / En attente / En retard, filtres Toutes / En attente / Payées / En retard et colonnes de la liste des factures.
- `public/clients.html` : Recherche rapide, Répertoire clients et colonnes Client / Contact / Montant dû / Total facturé.
- `public/rapports.html` : filtres de période, regroupement, Paiements enregistrés, Dépenses, Écart paiements - dépenses et TVA inscrite sur factures.
- `public/dashboard.html` : indicateurs Encaissements cumulés, Factures payées, Factures en attente et Solde net estimé, graphiques et dernières factures.

## Transparence des données

Ces images sont des reconstructions fidèles de l'architecture visuelle et des libellés HTML du dépôt, **pas des captures d'écran prises dans une session Sunupilot authentifiée**. Les valeurs, références et noms visibles sont fictifs et portent une mention d'aperçu démo. Les personnes sont des visuels générés, pas des clients ou employés réels.

Pour remplacer ces reconstructions par de vraies captures d'écran, il faut enregistrer les pages dans une session de démonstration authentifiée avec un jeu de données de démonstration contrôlé, puis remplacer les quatre captures dans le montage.

## Identité et périmètre

Le nom affiché est exclusivement **Sunupilot**. L'emblème officiel vient de `public/images/icon-192.png`. Le montage présente les fonctions documentées : factures et devis, clients, produits, suivi des règlements reçus, dépenses, rapports et interface responsive. Il ne promet ni paiement automatique ni abonnement payant.

## Narration et sous-titres

Le master de prévisualisation contient une voix de synthèse hors ligne, utile pour valider le texte et le minutage, et une musique instrumentale originale. Cette piste de synthèse n'est pas une prise de voix humaine définitive. Le script et les repères sont conservés dans `docs/SCRIPT_VOIX_OFF_SUNUPILOT.md`.

## Lecteur web

La page d'accueil attend le fichier :
`public/videos/sunupilot-presentation.mp4`

Les sous-titres sont :
`public/videos/sunupilot-presentation-fr.vtt`

Le binaire master et l'export mobile sont fournis dans le kit de production hors dépôt. L'intégration GitHub utilisée dans cette session ne permet pas le téléversement direct des binaires vidéo.

Avant fusion, ajouter le MP4 au chemin prévu puis tester lecture, audio, sous-titres, plein écran, chargement mobile et fallback. Ne pas fusionner avant cette recette.
