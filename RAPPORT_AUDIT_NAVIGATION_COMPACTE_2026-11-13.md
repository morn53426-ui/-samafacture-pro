# Audit UI — navigation compacte SamaFacture Pro
Date : 13 novembre 2026

## Problème constaté
La barre latérale partageait 260 px avec la zone de travail et ajoutait une carte promotionnelle de grande hauteur, alors que le Centre d'aide était déjà accessible dans la navigation. Sur des écrans étroits ou avec un zoom navigateur, cette présentation diminuait inutilement l'espace visible pour les pages de gestion.

## Corrections apportées
- Navigation de bureau compacte par défaut : 76 px au lieu de 248 px en mode développé.
- Bouton accessible pour développer/réduire le menu.
- Préférence mémorisée dans le navigateur sous `sf-sidebar-collapsed`.
- Libellés et groupes masqués visuellement en mode compact ; chaque lien conserve un `title` et un `aria-label`.
- Suppression de la carte promotionnelle latérale, dont le contenu d'aide reste accessible dans la rubrique Centre d'aide.
- Bloc compte, formule et déconnexion regroupés ; la déconnexion devient un vrai bouton.
- Navigation mobile et tablette conservée ; le tiroir mobile reprend la main à 900 px et moins.
- Aucun endpoint API, donnée métier, calcul, migration SQL ou mécanisme de paiement modifié.

## Vérifications automatisées ajoutées
Le test Puppeteer de recette vérifie désormais :
- largeur du rail compact et alignement de la zone principale à 1440 px ;
- ouverture/fermeture du menu et synchronisation des marges ;
- mémorisation de la préférence après rechargement ;
- bascule de la navigation desktop vers le menu mobile à 768 px ;
- absence de la carte promotionnelle dans la sidebar.

## Limites de la recette
Les tests Puppeteer utilisent des réponses API fictives, comme les autres tests visuels du dépôt. Les captures sur les appareils réels, les navigateurs effectivement utilisés par les clients et la vérification de l'ensemble des formulaires métier restent nécessaires avant mise en production.

## Finition visuelle globale
- Police des titres remplacée par Manrope ; les contenus utilisent Inter et les références chiffrées conservent JetBrains Mono.
- Hiérarchie des titres, espacements, paragraphes et en-têtes de page harmonisés.
- Champs et libellés de formulaires clarifiés, hauteurs et focus clavier uniformisés.
- Boutons, tableaux et cartes bénéficient de règles communes plus sobres.
- Les pictogrammes utilisent le jeu SVG existant (79 icônes) avec dimensions, épaisseur de trait, coins et alignements harmonisés.
- La variable de largeur active de la sidebar qui redéfinissait le menu à 286 px a été corrigée à 248 px ; le contrôle automatisé avait détecté cet écart.

## Tests complémentaires
- Contrôle de l'alignement à 248 px en mode développé.
- Vérification du choix Manrope/Inter dans le rendu CSS.
- Contrôle des attributs SVG communs (viewBox, linecap et linejoin).
- L'ensemble du contrôle responsive reste soumis au résultat du pipeline GitHub Actions.
