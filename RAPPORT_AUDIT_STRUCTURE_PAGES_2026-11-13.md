# Audit de l’organisation des pages — SamaFacture Pro
Date : 13 novembre 2026

## Objectif
Faire évoluer l’application d’un ensemble de pages fonctionnelles vers une interface de gestion plus cohérente et adaptée à un logiciel professionnel complet, sans modifier les API, les règles métier ou les données.

## Principes d’organisation
- Un en-tête de page identifiable avec un titre, une description et une action principale.
- Un repère de module pour comprendre immédiatement où l’utilisateur se trouve.
- Des filtres séparés des résultats qu’ils pilotent.
- Des tableaux et listes dotés d’un titre et d’un court contexte.
- Des indicateurs regroupés en cartes cohérentes.
- Des marges, espacements, libellés et actions cohérents entre les modules.
- Les tableaux larges défilent dans leur propre panneau plutôt que d’élargir la page entière.
- Les dispositions se réorganisent pour les tablettes et téléphones.

## Pages couvertes
- Tableau de bord : repère « Vue d’ensemble » et cadre de page partagé.
- Clients : recherche rapide dédiée et répertoire titré.
- Produits & services : catalogue titré avec contexte prix, fiscalité et stock.
- Facturation : cadre partagé autour du tableau de suivi existant.
- Devis : liste titrée et actions de transformation mieux contextualisées.
- Dépenses : journal clairement identifié.
- Rapports : filtres de période distincts, indicateurs, graphique et détail des résultats.
- Finances : en-tête de pilotage financier et panneaux de prévision/objectifs.
- Achats & stocks, CRM, Comptabilité OHADA, Paramètres, Abonnement et Paiements en ligne : rattachement au cadre commun et hiérarchie de page homogène.

## Système visuel partagé
S’appuie sur les polices Manrope, Inter et JetBrains Mono, les icônes SVG existantes et la palette bleu nuit / bleu vif / émeraude. Les styles communs améliorent le contraste, la lecture des en-têtes, la séparation des filtres et des données, les états vides et la lisibilité des tableaux.

## Tests ajoutés
La recette Puppeteer vérifie, sur les pages principales :
- présence du conteneur de page partagé ;
- présence d’un en-tête et d’un repère de module ;
- titre de zone de données sur les pages de listes ;
- absence d’icône statique inconnue non convertie en SVG ;
- absence de débordement horizontal aux largeurs existantes (320, 390, 768 et 1440 px).

## Hors périmètre
Aucun endpoint ni schéma SQL modifié, aucune logique de facturation, de paiement, de calcul ou de stock modifiée. Les captures Puppeteer injectent des données fictives ; elles ne remplacent pas une recette sur le serveur et les appareils réels.
