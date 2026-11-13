# Audit de l’organisation des pages — SamaFacture Pro
Date : 13 novembre 2026

## Objectif
Faire évoluer l’application d’un ensemble de pages fonctionnelles vers une interface de gestion cohérente, lisible et adaptée à un logiciel professionnel complet, sans modifier les API, les règles métier ou les données.

## Principes d’organisation
- Un en-tête de page identifiable avec titre, description et action principale.
- Un repère de module pour comprendre immédiatement où se trouve l’utilisateur.
- Des filtres séparés des résultats qu’ils pilotent.
- Des tableaux et listes dotés d’un titre et d’un court contexte.
- Des indicateurs regroupés en cartes cohérentes.
- Des marges, espacements, libellés et actions homogènes.
- Les tableaux larges défilent dans leur propre panneau plutôt que d’élargir la page.
- Les dispositions se réorganisent pour les tablettes et téléphones.
- Les modales et formulaires héritent du système commun de champs, de focus et de boutons.

## Pages couvertes
- Tableau de bord, facturation, devis et factures récurrentes.
- Clients, produits & services et dépenses.
- Rapports et tableau de bord financier.
- Achats & stocks, CRM, Comptabilité OHADA.
- Paramètres, abonnement, paiements en ligne.
- Internationalisation et automatisations.
- Création de facture/devis, assistant IA et création de facture par IA.

## Système visuel partagé
Polices Manrope (titres), Inter (textes) et JetBrains Mono (références et valeurs techniques), icônes SVG existantes, palette bleu nuit / bleu vif / émeraude. Les styles communs améliorent la hiérarchie des titres, les espacements, la séparation des filtres et des données, les états vides et la lisibilité des tableaux.

## Tests ajoutés
La recette Puppeteer vérifie, sur les pages principales :
- présence du conteneur de page partagé ;
- présence d’un en-tête et d’un repère de module ;
- titre de zone de données sur les pages de listes ;
- polices Manrope et Inter ;
- filtres séparés de la liste sur Clients et Rapports ;
- absence d’icône statique inconnue non convertie en SVG ;
- absence de débordement horizontal aux largeurs existantes (320, 390, 768 et 1440 px).
- les factures récurrentes sont injectées dans le scénario de test avec des réponses API fictives.

## Hors périmètre
Aucun endpoint, schéma SQL, calcul de facturation, mécanisme de paiement ou mouvement de stock volontairement modifié. Les captures Puppeteer utilisent des données fictives ; elles ne remplacent pas la recette des actions métier avec un compte réel, les essais sur les appareils physiques et la vérification des PDF.
