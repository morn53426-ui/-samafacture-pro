# Audit visuel et ergonomique — SamaFacture Pro

Date : 13 novembre 2026  
Branche : `audit/ui-runtime-pages-polish-20261113`  
Base : `main` au commit `204f96d8b8a169383f5c3042fd26cbf1aa596896`

## Constats issus de l’interface

1. **Navigation latérale trop large** : le dernier thème CSS fixe la largeur du menu à 286 px, avant les ajustements de la branche. Cette colonne réduit l’espace réellement disponible pour les tableaux, les formulaires et les graphiques.
2. **Encart promotionnel encombrant** : la carte « Découvrez l’aide » utilise de la hauteur dans la navigation alors que le Centre d’aide et le Support sont déjà accessibles dans les liens du menu.
3. **Navigation chargée** : les groupes et liens occupent une grande hauteur. Les pages métier doivent conserver la priorité visuelle.
4. **Libellés d’icônes incohérents** : plusieurs noms d’icônes utilisés auparavant n’existaient pas dans le registre SVG. Les liens concernés pouvaient apparaître sans leur pictogramme.
5. **Initialisation Docker concurrente** : l’API et le worker PDF pouvaient tenter l’initialisation du schéma MySQL simultanément, ce qui explique les attentes sur le verrou d’initialisation constatées pendant le démarrage local.

## Corrections proposées dans cette livraison

- Navigation de bureau compacte par défaut (78 px), avec déploiement à 264 px depuis un bouton clairement identifiable.
- Préférence de largeur mémorisée dans le navigateur ; le menu mobile conserve son fonctionnement en tiroir.
- Retrait de la carte promotionnelle latérale ; l’aide reste accessible depuis les liens « Centre d’aide » et « Support technique ».
- Pied de menu clarifié : thème, formule, compte et déconnexion ; en mode compact, les commandes essentielles restent accessibles par icônes.
- Libellés accessibles et état de page active exposé avec `aria-current`.
- Icônes de navigation remplacées par des pictogrammes réellement disponibles dans le registre SVG.
- Démarrage Docker plus déterministe : un worker API par défaut et attente de disponibilité de l’API avant le lancement du worker PDF.

## Vérifications automatisées ajoutées

- Largeur et alignement du menu compact à 1440 px.
- Largeur et alignement du menu déployé à 1440 px.
- Visibilité des libellés et état actif accessible.
- Absence de débordement horizontal dans les deux modes.
- Captures dédiées des modes compact et déployé.
- Conservation des tests existants : pages métier, 4 largeurs, thème sombre, zoom 200 %, recherche, notifications, création de facture et devis.

## Limites de validation

Les corrections de code sont préparées sur une branche dédiée. La validation CI et les captures finales du navigateur doivent réussir avant toute fusion. La vérification sur le poste local reste nécessaire pour confirmer le rendu avec la taille d’écran, le zoom et les préférences du navigateur utilisés au quotidien.

Le correctif Docker ne remplace pas les tests métier de génération d’un vrai PDF, l’envoi d’emails, le sandbox Wave/PayDunya, la restauration de sauvegarde ou une recette mobile réelle.