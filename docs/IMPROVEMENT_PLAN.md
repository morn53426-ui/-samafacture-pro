# Plan d'amélioration — SamaFacture Pro

**Date de référence :** 21 novembre 2026  
**Branche de référence :** `main`  
**Commit de référence :** `f49d352125352d009da9abebd2ceecbb122c6d6b`  
**Règle de travail :** toute évolution passe par une branche et une Pull Request. Ne pas modifier directement `main`, ne pas fusionner une PR dont les contrôles requis échouent et ne pas déployer sans validation dédiée.

Ce document est un plan de travail vivant. Les états ci-dessous reflètent les preuves GitHub consultées à la date de référence ; « en cours » ou « à vérifier » ne signifie pas « résolu ».

## Synthèse des priorités

| Nº | Priorité | Chantier | État au 21/11/2026 |
|---:|---|---|---|
| 1 | P1 | Identification des factures/devis sur chaque page PDF | PR #112 fusionnée dans main ; CI #1216 verte après intégration du profil headless |
| 2 | P1 | Recette exhaustive des 31 modèles facture et 31 modèles devis | Géométrie des bandeaux validée sur main ; recette visuelle complète à étendre |
| 3 | P1 | Invariants financiers, TVA, remises et arrondis | Tests facture/paiement/partie double présents ; PR #115 ajoute dépense, idempotence et isolation tenant (CI en cours) |
| 4 | P1 | Qualité d'impression et fidélité aperçu/PDF | PR #111 et #112 fusionnées ; recette Chromium et PDF multipages passée, inspection humaine d'un échantillon encore à faire |
| 5 | P2 | Accessibilité clavier, clair/sombre et contrastes | Badge de marque corrigé (contraste calculé 6,10:1–9,15:1) ; CI #44917515326 en cours |
| 6 | P2 | Routage des stocks et annulations par entrepôt | PR #106 fusionnée dans main ; scénario vente/annulation multi-entrepôts intégré |
| 7 | P2 | Responsive, zoom et performances | Recette responsive main réussie ; profilage de performance non réalisé |
| 8 | P2 | Durcissement sécurité, sessions et sauvegardes | CSP et jeton localStorage encore à faire évoluer |
| 9 | P2 | Identité visuelle et rebranding | PR #99 non fusionnable ; marque encore à valider juridiquement |
| 10 | P3 | Audit final, documentation, code mort et gouvernance | Présent plan ; travail continu à organiser |

---

## 1. Impression PDF multipages — P1

**État :** intégré dans `main` par la PR #112 ; vérification automatisée réussie, échantillon PDF à inspecter manuellement.

La PR #111 a corrigé les marges négatives historiques des bandeaux et a été fusionnée dans `main`. Sa CI a validé la géométrie des bandeaux sur 31 modèles facture et 31 modèles devis, avec génération PDF A4 via Chromium.

La PR #112 a été fusionnée dans `main` le 21 novembre 2026 (commit `f49d352`). Elle ajoute les zones de marge CSS Paged Media qui répètent le nom de l'entreprise, le type de document et sa référence sur les pages suivantes, et transmet le profil retourné par `/auth/me` aux formateurs de dates et montants pour le rendu headless. La CI #1216 a validé les tests, ESLint, le packaging et la recette visuelle multipages ; l'artefact PDF a été généré, mais une inspection humaine d'un échantillon reste requise.

**Critères d'acceptation**
- Le nom de l'entreprise, FACTURE/DEVIS et le numéro sont visibles sur chaque page de continuation.
- La première page conserve son bandeau principal et n'affiche pas un rappel redondant.
- Les marges, la zone utile, les tableaux et les signatures ne se chevauchent pas.
- Les noms d'entreprise et références sont échappés comme données CSS.
- Les PDF facture longue et devis long sont produits en A4 et inspectés ; la présence de règles CSS seules ne suffit pas à prouver le rendu final.
- Aperçu écran inchangé.

**Tests requis :** ESLint, tests Node/MySQL, recette Chromium, PDF A4 facture et devis multipages, restauration sauvegarde chiffrée, smoke MySQL/Redis, packaging ZIP.

**Références :** PR #111 (fusionnée), PR #112 (fusionnée dans `main`, commit `f49d352`).

## 2. Recette exhaustive des modèles — P1

**État :** partiellement validé.

La vérification des bandeaux historiques couvre 31 modèles de factures et 31 modèles de devis. Étendre le contrôle au-delà des seules marges : typographie, logos, largeur des colonnes, totaux, blocs TVA, mentions, coordonnées, signatures et pieds de page.

**Critères d'acceptation**
- Chaque modèle est testé au minimum en facture et devis.
- Les textes longs, références longues, noms d'entreprise, accents, caractères spéciaux, nombreuses lignes et données vides sont couverts.
- Aucun élément essentiel n'est coupé, masqué ou superposé.
- Les restrictions de modèles par formule sont affichées correctement.
- Un échantillon de PDF est inspecté visuellement en plus des assertions automatisées.

**Tests requis :** matrice 31 × 2, captures d'écran, PDF A4 et contrôles de débordement.

## 3. Invariants financiers — P1

**État :** les tests couvrent facture, paiement, écriture déséquilibrée et balance ; la PR #115 ajoute les écritures de dépense, le rejeu idempotent, le grand livre et l'isolation entre entreprises. La validation CI reste en cours.

Préserver strictement les montants déjà calculés lors des améliorations visuelles ou de génération PDF.

**Critères d'acceptation**
- Vérifier HT, TVA par taux, TTC, remises, livraison, acomptes, montants réglés et solde dû.
- Les totaux affichés dans le PDF correspondent aux données persistées et à l'écran.
- Les arrondis sont déterministes et cohérents entre les pages, les exports et les PDF.
- Un devis affiche sa validité, pas une échéance de paiement ni un solde à payer.
- Une facture affiche l'échéance et le solde dû selon son statut.
- Aucun calcul métier n'est dupliqué uniquement pour le rendu PDF.

**Tests requis :** jeux de données unitaires et intégration couvrant TVA multi-taux, remises, livraison, paiements partiels, valeurs nulles et montants limites.

## 4. Qualité d'impression et fidélité aperçu/PDF — P1

**État :** PR #111 et #112 intégrées ; la géométrie des 31 modèles facture et 31 modèles devis ainsi que la recette PDF multipages passent en CI. Il reste une revue humaine des artefacts et un contrôle d'impression sur navigateurs réels.

**Critères d'acceptation**
- Format A4 stable, marges prévisibles et largeur utile constante.
- Bandeau supérieur complet, texte visible et logo non déformé.
- Aucun titre, numéro, tableau, total ou signature tronqué.
- En-têtes de colonnes répétées et coupures de lignes contrôlées.
- Pas de page blanche ou de dernière page quasi vide injustifiée.
- Couleurs papier lisibles en couleur et en niveaux de gris.
- Le thème de l'application n'altère pas la palette d'impression.
- Le rendu d'impression navigateur et le PDF téléchargé restent cohérents.

**Tests requis :** Chrome/Chromium, PDF A4 multipages, inspection des artefacts et comparaison avec l'aperçu écran.

## 5. Accessibilité et thèmes — P2

**État :** la CI précédente a détecté un vrai défaut de contraste sur le badge `PILOT` (texte vert sur dégradé doré). Le badge conserve son fond doré avec un texte bleu nuit ; les ratios calculés sur les deux extrémités sont de 6,10:1 et 9,15:1. La nouvelle CI (#44917515326) doit encore confirmer le parcours complet des 17 pages en clair et sombre.

**Critères d'acceptation**
- Les 17 pages métier sont vérifiées en thème clair et sombre.
- Les contrôles visibles sont atteignables avec Tab et Maj+Tab.
- Les champs date natifs, sélecteurs, filtres, exports, menus et modales ont un focus visible.
- Le contraste respecte WCAG AA : 4,5:1 pour le texte courant et 3:1 pour le grand texte.
- Les noms accessibles, libellés de champs, titres et alternatives d'images sont présents.
- Les contrôles automatisés ne masquent pas les véritables défauts sous prétexte d'une limite Chromium.
- Des essais manuels VoiceOver et NVDA restent requis avant toute déclaration de conformité complète.

**Tests requis :** 34 passages Chromium, tests clavier, contraste, captures par thème et tests manuels de lecteurs d'écran.

**Référence :** PR #110. Consolider ou clôturer l'ancienne PR #102 après revue, afin d'éviter deux campagnes concurrentes.

## 6. Achats et stocks — P2

**État :** PR #106 fusionnée dans `main` ; vente et annulation testées avec le dépôt PRINCIPAL, le dépôt secondaire restant inchangé.

**Critères d'acceptation**
- Une vente sans dépôt explicitement choisi débite uniquement le Magasin principal (PRINCIPAL), conformément au comportement documenté.
- Le stock d'un entrepôt secondaire n'est pas modifié par cette vente.
- L'annulation restitue la quantité au dépôt effectivement débité, sans double restitution.
- Le stock catalogue correspond à la somme des stocks d'entrepôts.
- Devis, transformation de devis, duplication, suppression et concurrence vente/annulation suivent des règles cohérentes.
- Les quotas du plan ne rendent pas les tests de stock non déterministes.

**Tests requis :** intégration MySQL, vente, annulation, suppression, transformation, duplication et concurrence.

**Référence :** PR #106. Toute évolution ultérieure permettant de choisir un entrepôt dans le flux facture devra être un chantier métier séparé, avec validation explicite.

## 7. Responsive, zoom et performances — P2

**État :** la recette responsive de main a réussi sur 133 captures et 7 largeurs ; le profilage de performance n'a pas été exécuté.

**Critères d'acceptation**
- Vérifier les largeurs 320, 375/390, 430, tablette, desktop et ultra-large.
- Zoom 200 % sans perte de contenu ou d'action.
- Aucun débordement horizontal du document entier ; les tableaux larges défilent dans leur conteneur.
- Menus, modales, formulaires et actions restent utilisables au tactile.
- Images, icônes, polices et graphiques ne provoquent pas de décalages majeurs.
- Mesurer les performances avant d'annoncer une amélioration : chargement, poids des ressources, erreurs console et temps des interactions.

**Tests requis :** recette Chromium multi-largeurs, zoom 200 %, audit réseau/performance et essais réels Safari iOS/Chrome Android.

## 8. Sécurité, authentification et sauvegardes — P2

**État :** dette documentée. L'audit npm de main a signalé zéro vulnérabilité dans la CI consultée ; cela ne remplace pas les contrôles CodeQL, Dependabot ou secret scanning lorsque ceux-ci sont accessibles.

**Constats à traiter**
- `server/app.js` autorise encore `unsafe-inline` dans `script-src` et `style-src`.
- `public/js/api.js` conserve le jeton `sf_token` dans `localStorage`.
- La migration vers le cookie HttpOnly est progressive.

**Critères d'acceptation**
- Réduire la dépendance à `localStorage` et achever une migration testée vers les cookies HttpOnly.
- Maintenir une protection CSRF adaptée au mode cookie.
- Remplacer progressivement `unsafe-inline` par des nonces/hashes ou des scripts/styles externes.
- Vérifier les règles de session, révocation, expiration et rotation.
- Maintenir les restrictions réseau du renderer PDF et la protection contre l'exfiltration/SSRF.
- Tester les sauvegardes chiffrées par une restauration réelle.
- Exécuter npm audit et les analyses GitHub disponibles.

**Références :** `server/app.js`, `public/js/api.js`, `SECURITY_REPORT.md`.

## 9. Identité visuelle — P2

**État :** PR #99 non fusionnable et sur une base ancienne. Le contrôle de contraste précédemment consulté indiquait 3,97:1, sous l'objectif 4,5:1. Le nom SunuPilot reste un candidat tant que les vérifications juridiques OAPI ne sont pas achevées.

**Critères d'acceptation**
- Corriger les contrastes clair/sombre.
- Résoudre les conflits et rebaser sur main avant une nouvelle validation.
- Vérifier logo, favicon, icônes, écrans de connexion, pages métier, factures, devis, portail client, emails, PWA et application mobile.
- Préserver les identifiants techniques et la compatibilité des intégrations historiques.
- Ne pas lancer de publication commerciale sous le nouveau nom avant validation juridique.

**Référence :** PR #99. Aucun changement de marque ne doit être fusionné uniquement sur la base du packaging ou d'ESLint.

## 10. Audit final, documentation et gouvernance — P3

**État :** présent document créé pour centraliser le suivi ; audit final non réalisé.

**Critères d'acceptation**
- Refaire les tests complets à partir du commit main final.
- Effectuer une analyse AST des imports, exports, fonctions et fichiers potentiellement inutilisés ; signaler sans supprimer automatiquement.
- Corriger les commentaires et références documentaires obsolètes, notamment les mentions de `AUDIT_PRODUCTION.md` si ce fichier reste absent.
- Consolider les PR remplacées et éviter les branches obsolètes.
- Vérifier les règles détaillées de protection de main lorsque l'accès GitHub le permet.
- Vérifier la licence et la gouvernance du dépôt public.
- Produire un rapport final P0–P3 avec preuves, limites d'accès et décisions restantes.

---

## Règles de sortie et de fusion

1. Une CI rouge bloque la fusion.
2. Une CI verte est nécessaire mais ne remplace pas la revue fonctionnelle et de code.
3. Ne jamais confondre un échec de test de recette avec un bug produit sans reproduction.
4. Ne pas supprimer de code potentiellement mort sans preuves d'absence d'utilisation et revue.
5. Ne pas modifier directement `main`.
6. Ne pas activer de paiement ou de déploiement dans le cadre de ce plan sans demande et validation distinctes.

## Journal de référence

- **PR #111 :** fusionnée dans main ; correction des marges négatives des bandeaux et recette géométrique des 31 modèles facture et 31 modèles devis passée.
- **PR #112 :** fusionnée dans `main` le 21 novembre 2026 (commit `f49d352`) ; tests, ESLint, packaging et recette visuelle multipages réussis.
- **PR #113 :** fermée comme doublon après vérification que ses quatre fichiers et ses tests headless sont présents dans la PR #112 fusionnée.
- **PR #110 :** ouverte ; correction du contraste du badge `PILOT` poussée sur la branche, tests automatisés en cours sur le commit `3e349715`.
- **PR #106 :** fusionnée dans main par le commit `5478809e` ; la vente et son annulation sont vérifiées avec un entrepôt secondaire isolé.
- **PR #99 :** ouverte ; conflits et contraste à corriger, validation juridique requise.
- **PR #102 :** ancienne campagne d'accessibilité à consolider avec #110.
- **PR #115 :** tests de comptabilisation des dépenses, anti-doublon, grand livre et isolation multi-entreprise ; CI en cours.

Ce journal doit être mis à jour à chaque nouvel audit en distinguant les changements réels, les résultats de CI et les vérifications non exécutées.
