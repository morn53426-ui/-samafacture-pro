# Modernisation UI — SamaFacture Pro

Cette branche conserve l'identité bleu nuit / émeraude / or et modernise les composants partagés de l'application, sans modifier les parcours métier.

## Direction visuelle
- Titres plus hiérarchisés, typographie fluide et espacements cohérents.
- Cartes, tableaux, formulaires et modales avec contours et ombres plus discrets.
- Pages publiques, authentification et vues de gestion harmonisées.
- Icônes SVG de même famille, alignées et mises en valeur dans la navigation et les actions.
- Thèmes clair et sombre avec contrastes adaptés.

## Icônes
La bibliothèque `public/js/icons.js` a été enrichie de 35 pictogrammes SVG : édition, suppression, fichiers, sécurité, notifications, filtres, recherche, calendrier, navigation et états.
Les actions principales des pages Factures, Devis, Clients, Produits, Dépenses et Factures récurrentes affichent désormais leurs pictogrammes.

## Responsive et accessibilité
- Grilles et titres adaptatifs.
- Gestion des débordements dans les cartes et les tableaux.
- Zones tactiles et focus clavier visibles.
- Navigation mobile annoncée aux lecteurs d'écran et fermeture après sélection.
- Respect des zones de sécurité des smartphones et de la préférence de réduction des animations.

## Périmètre
Aucune route API, migration SQL, donnée métier ou règle de calcul n'est modifiée.

## Vérifications
- CSS ajouté avec accolades équilibrées.
- Bibliothèque d'icônes contrôlée : aucune clé dupliquée.
- Références d'icônes des actions modifiées contrôlées.
- Les tests Node du backend et les contrôles visuels sur navigateurs réels restent à exécuter avant fusion.
