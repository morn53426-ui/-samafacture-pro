# Modernisation UI — SamaFacture Pro

Cette branche conserve l'identité bleu nuit / émeraude / or et modernise les composants partagés ainsi que les principales pages métier. Les règles de facturation et les API existantes sont conservées.

## Abonnement
- Carte de synthèse du plan actuellement associé au compte.
- Comparaison de quatre formules avec descriptions, avantages et tarifs mensuels.
- Tarifs affichés depuis l'API serveur : Gratuit, Starter, Pro et Entreprise.
- Mise en avant visuelle du plan Pro.
- Boutons Wave et PayDunya/Orange Money affichés seulement lorsque le fournisseur est déclaré disponible par le serveur.
- Offre Entreprise marquée « bientôt disponible » pour ne pas présenter le multi-sociétés comme déjà livré.
- Sélecteur manuel clairement signalé comme mode de test, sans prétendre effectuer un paiement.

## Facturation et création de documents
- Indicateurs de chiffre d'affaires, factures payées, en attente et en retard, alimentés par le tableau de bord existant.
- Liste de factures modernisée avec références, montants, solde restant dû, statuts et actions en icônes.
- Présentation responsive de la liste sous forme de fiches sur téléphone.
- Fenêtre d'encaissement modernisée : contexte de la facture, solde restant affiché et montant prérempli au solde dû, tout en autorisant les paiements partiels.
- Écran de création de facture/devis harmonisé : type de document, informations client, lignes et récapitulatif mieux hiérarchisés.

## Système visuel et icônes
- Cartes, tableaux, formulaires, modales, navigation et pages publiques harmonisés.
- Bibliothèque de 79 icônes SVG cohérentes, dont 35 nouvelles.
- Thèmes clair et sombre, focus clavier, zones tactiles et adaptations mobile/tablette.
- Respect de la préférence de réduction des animations.

## Périmètre technique
Aucune route API, migration SQL, règle de calcul, donnée métier ou tarif serveur n'a été modifié. Les pages s'appuient sur les routes existantes `/dashboard`, `/factures` et `/abonnement/moyens-disponibles`.

## Vérifications effectuées
- Syntaxe JavaScript vérifiée par compilation des scripts intégrés et des scripts partagés.
- Références SVG contrôlées : aucune icône manquante dans les pages concernées.
- CSS contrôlé : accolades équilibrées.
- Les tests automatisés Node du dépôt et les essais visuels sur navigateurs et appareils réels restent à effectuer avant fusion.
