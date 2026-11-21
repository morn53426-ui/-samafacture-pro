# Vidéo de présentation — Sunupilot

## Master publicitaire avec personnes

- Master MP4 H.264, 1920 × 1080, 24 i/s, AAC stéréo 48 kHz.
- Durée : 45,4 secondes.
- Export mobile horizontal : MP4 H.264, 1280 × 720.
- Sept séquences : ouverture humaine, factures/devis, équipe au travail, clients, rapports, interface mobile et conclusion humaine.
- Fondus enchaînés de 0,6 seconde, mouvement de caméra numérique discret, fondu d'ouverture et de fermeture.
- Bande musicale instrumentale originale en stéréo.
- Sous-titres français WebVTT.
- Miniature vidéo livrée séparément dans le pack de production.

## Identité de marque

Le nom visible est exclusivement **Sunupilot**. L'emblème utilisé dans le montage provient de l'icône officielle du dépôt `public/images/icon-192.png`. Les couleurs suivent l'identité vert baobab et indigo.

## Personnes et visuels

Les personnes visibles sont des visuels générés pour illustrer des situations professionnelles. Elles ne représentent pas des clients, des employés ou des ambassadeurs réels de Sunupilot.

Les écrans de l'application sont des maquettes de démonstration construites à partir des fonctionnalités documentées. Ils sont identifiés comme démonstration et ne sont pas des captures d'une session réelle.

## Périmètre fonctionnel

Le montage présente uniquement des fonctions documentées : factures et devis, clients, produits, suivi des règlements reçus, dépenses, rapports et interface web responsive. Il ne promet ni paiement automatique ni souscription payante.

## Voix off

Le master inclut une bande instrumentale originale mais aucune voix off parlée. Le fichier WebVTT contient les sous-titres français et le kit livré contient un script de narration à enregistrer séparément.

## Intégration du lecteur web

Le lecteur HTML5 de la page d'accueil attend :
`public/videos/sunupilot-presentation.mp4`

Les sous-titres sont chargés depuis :
`public/videos/sunupilot-presentation-fr.vtt`

La miniature SVG déjà intégrée reste une couverture de secours. Le MP4 master et sa version mobile sont livrés séparément car le connecteur GitHub utilisé ne permet pas de téléverser directement le binaire vidéo dans cette session.

Avant fusion, ajouter le master à l'emplacement attendu, puis tester lecture, son, sous-titres, plein écran, chargement mobile et fallback lorsque le MP4 est absent. Ne pas fusionner avant cette recette.
