# Plan d'amélioration — SamaFacture Pro

**Référence de ce point de situation :** 22 novembre 2026, 00:05 UTC  
**Branche de référence :** `main`  
**Commit de référence :** `8453ee6d8e633f151523236eecff1bc0e0cf877b`

Ce document distingue les changements présents sur une branche, les contrôles réellement réussis, les contrôles encore en cours et les dépendances qui empêchent une livraison. Une PR ouverte ou un commit présent ne signifie pas que la fonctionnalité est validée ou livrée.

## Règles d'intégration

1. Ne pas modifier directement `main`.
2. Ne pas fusionner une PR dont la CI requise est rouge, incomplète ou exécutée sur un ancien HEAD.
3. Ne pas considérer un artefact généré comme une validation sans inspection.
4. Ne pas activer les paiements ou le renouvellement automatique sans demande, intégration prestataire et validation distinctes.
5. Une branche issue d'un ancien `main` doit être synchronisée et retestée avant toute intégration.
6. Ne pas supprimer les branches ou PR remplacées avant de vérifier que leurs changements utiles sont consolidés.

## Synthèse des chantiers

| Priorité | Chantier | Référence | État vérifié |
|---|---|---|---|
| P1 | PDF A4 multipages, factures et devis | PR #125 | CI complète verte sur HEAD `8eebb236` ; 31 modèles facture et 31 modèles devis vérifiés avec 28 lignes longues ; maximum constaté et exigé : 3 pages A4 |
| P1 | Essai gratuit et espace professionnel | PR #128 | CI verte sur HEAD `e3b91dc4` ; essai de 15 jours sur Standard, Pro et Entreprise, avec règles de non-réinitialisation et d'expiration testées |
| P1 | Cycle de vie comptable des factures et dépenses | PR #117 | Branche synchronisée avec le `main` actuel ; tests Node/MySQL et recette visuelle en cours sur le nouveau HEAD `ba756d09` |
| P1 | Contraste et navigation clavier clair/sombre | PR #130 | Correctifs sur une branche neuve ; ESLint et ZIP verts sur un commit précédent ; suite Chromium/MySQL en cours sur le dernier HEAD |
| P1 | Vidéo de présentation Sunupilot | PR #126 | Code du lecteur, capture locale et tests présents ; master MP4 final absent du dépôt, donc le lecteur reste sur l'animation de secours |
| P2 | Gouvernance et feuille de route | PR #131 (ce document) | Mise à jour proposée sur la base du `main` actuel |
| P2 | Identité visuelle/rebranding étendu | PR #99 | Ancienne branche divergente ; ne pas intégrer sans revue indépendante et validation de marque |

## 1. PDF facture et devis — P1

**PR de travail :** [#125](https://github.com/morn53426-ui/-samafacture-pro/pull/125)  
**HEAD contrôlé :** `8eebb2363a9fa0e5de58f5f49407771b61b40908`

La branche a été synchronisée avec le `main` de référence sans réécriture forcée. La CI complète du HEAD a réussi : tests Node/MySQL, sauvegarde chiffrée et restauration, smoke test MySQL/Redis, ESLint, packaging et recette Chromium.

La recette a généré 324 captures et deux PDF de démonstration réels A4. Le rapport vérifie les 31 modèles pour les factures et les 31 modèles pour les devis, avec 28 lignes longues. Tous les modèles produisent au plus trois pages. Les contrôles confirment les bandeaux sans débordement, les titres, les images chargées (logos, QR et signatures), les totaux et les panneaux complémentaires. Les documents de démonstration contrôlés ont chacun trois pages A4 ; le panneau « Bon pour accord » est visible sur la troisième page du devis, pas isolé sur une quatrième.

Le modèle Tech conserve 9,5 pt ; le modèle Majesté conserve 9 pt et emploie un espacement d'impression plus compact. Les seuils de pagination ne sont pas abaissés.

**À faire avant clôture :** conserver la PR en brouillon jusqu'à la revue humaine d'un échantillon imprimé sur Chrome/Safari et sur une imprimante réelle. Ne pas fusionner automatiquement à la seule lecture d'une CI verte.

## 2. Essai gratuit de 15 jours et espace professionnel — P1

**PR de travail :** [#128](https://github.com/morn53426-ui/-samafacture-pro/pull/128)  
**HEAD contrôlé :** `e3b91dc4ae459fc4fdd65b63dd440f632ccd4217`

Les tests couvrent :
- Standard (nom commercial du palier historique `starter`), Pro et Entreprise ;
- une période de 15 jours calculée en UTC ;
- le changement de formule pendant l'essai sans remise à zéro du compteur ;
- le retour au plan Gratuit à l'expiration, avec conservation des données ;
- l'absence d'essai individuel concurrent lorsqu'un compte rejoint une équipe ou un groupe de sociétés.

Le parcours d'inscription propose la formule à essayer et indique qu'aucune carte bancaire ni aucun prélèvement automatique n'est requis. Les plans payants restent désactivés en checkout : aucun paiement d'abonnement ni prélèvement automatique n'est activé.

L'organisation de l'espace professionnel et des paramètres est présente dans la branche. Les ancres des pages Paramètres, Professionnel et Comptabilité pointent vers des sections existantes.

**À faire avant intégration :** garder la PR ouverte jusqu'à revue du code et confirmation de la CI sur son HEAD courant. Ne pas fusionner la PR #129 en parallèle : sa navigation reprend une partie de ce travail.

## 3. Comptabilité — annulation, réactivation et dépenses — P1

**PR consolidée :** [#117](https://github.com/morn53426-ui/-samafacture-pro/pull/117)  
**HEAD de travail :** `ba756d09888474477a19c182b42c1298ef092dd8`

La branche #117 a été synchronisée sur le `main` de référence via un commit de merge non destructif, puis le test exclusif de la PR #115 a été ajouté à cette branche consolidée. La couverture attendue inclut :
- contre-passation des écritures lors de l'annulation/réactivation d'une facture ;
- absence de doublons lors des transitions répétées ;
- comptabilisation des dépenses équilibrée en débit/crédit ;
- rejeu idempotent ;
- isolation entre entreprises.

La suite CI sur le HEAD actualisé est encore en cours au moment de ce point de situation. Les anciennes validations exécutées sur une base précédente ne suffisent pas à déclarer la branche validée.

**À faire :** attendre le résultat de la CI complète sur `ba756d09`, corriger toute régression détectée et inspecter les écritures générées. Ne pas fusionner #115 séparément : son test de dépense a été porté dans #117.

## 4. Accessibilité — contraste et clavier — P1

**PR de travail :** [#130](https://github.com/morn53426-ui/-samafacture-pro/pull/130)  
**Branche :** `fix/accessibility-contrast-focus-main-20261121`

Les défauts reproduits sur les anciennes campagnes sont traités sur une branche créée depuis le `main` actuel :
- le rouge décoratif `--clay` (4,23:1 sur les montants de dépenses) est distingué du rouge de texte `--clay-text` ;
- les montants dus des clients utilisent la couleur de texte accessible ;
- les couleurs de statuts et de soldes sont différenciées selon le thème ;
- le badge « PILOT » posé sur un dégradé doré utilise un texte bleu nuit ;
- les champs date natifs ont un focus visible ; les composants qui dessinent leur contour sur un parent utilisent `:focus-within` ;
- les cartes de rapports utilisent des extrémités de dégradé assez sombres pour le texte blanc ;
- les aperçus de facture dans Paramètres ont un filigrane plus contrasté.

La nouvelle recette exécute le parcours Tab/Maj+Tab et le contrôle de contraste sur les pages métier en thème clair et sombre. Une première exécution a révélé un badge « PILOT » à 1,05:1 ; ce défaut a été corrigé sur le dernier HEAD. La CI doit encore confirmer la recette complète sur ce dernier commit.

**Limite :** la recette Chromium ne remplace pas les essais manuels VoiceOver (Safari/iOS/macOS) et NVDA (Firefox/Windows).

Les PR #110 et #102 sont des campagnes anciennes ; leurs correctifs utiles sont consolidés dans #130. Ne pas fusionner leurs branches en parallèle.

## 5. Vidéo de présentation Sunupilot — P1

**PR de travail :** [#126](https://github.com/morn53426-ui/-samafacture-pro/pull/126)

La page d'accueil possède un lecteur natif MP4 avec un lecteur animé de secours. Les scripts de capture locale authentifiée et de données fictives sont présents et les tests automatisés de cette PR sont verts.

**Blocage explicite :** le master MP4 final attendu n'est pas présent dans `main`, dans la branche #126 ni dans les fichiers accessibles recherchés. La vidéo finale ne peut donc pas être considérée comme intégrée ou silencieuse sur la base du seul lecteur de secours.

**À faire :** fournir le master vidéo final souhaité, retirer sa piste audio si la version demandée est silencieuse, l'ajouter à `public/videos/sunupilot-presentation.mp4`, exécuter `npm run validate:video-asset`, puis contrôler la lecture réelle dans Chrome, Safari et sur mobile. Ne pas fusionner #126 comme une vidéo finalisée avant cette recette. La PR #118 est une variante antérieure et ne doit pas être fusionnée en parallèle.

## 6. PR remplacées ou basées sur un ancien main

- **#127** : correction Executive déjà consolidée dans #125 ; ne pas fusionner séparément.
- **#129** : variante de navigation déjà couverte par #128 ; ne pas fusionner séparément.
- **#115** : test de comptabilisation des dépenses repris dans #117 ; branche historique à ne pas fusionner séparément.
- **#114** : ancienne version de cette feuille de route, basée sur un ancien `main`.
- **#99** : rebranding étendu sur une branche ancienne et divergente ; ne pas intégrer sans audit des diffs, contrastes et validation juridique.
- **#110 / #102** : campagnes d'accessibilité antérieures ; les correctifs utiles sont repris dans #130.

Une PR remplacée peut rester ouverte le temps de vérifier son historique ; sa présence ne signifie pas qu'elle est encore une branche d'intégration indépendante.

## 7. Sécurité, paiements et déploiement — P2

- Les paiements d'abonnement et les renouvellements automatiques restent inactifs.
- Les paiements d'abonnement ne doivent s'activer qu'après confirmation prestataire et consentement explicite, avec des tests de webhook et d'idempotence.
- Continuer la revue de session/cookies, CSRF, CSP, protection PDF/SSRF et secrets.
- Une sauvegarde n'est validée qu'après une restauration réelle.
- Aucun déploiement ou changement de production n'est couvert par les validations décrites ici.

## Journal de vérification

| Date / référence | Résultat vérifié |
|---|---|
| 21/11/2026 — main `8453ee6` | Référence de départ de ce plan |
| 21/11/2026 — PR #125 / run `44963765145` | CI complète verte ; 31 modèles facture et 31 modèles devis ; 28 lignes longues ; plafond de trois pages ; 324 captures |
| 21/11/2026 — PR #128 / HEAD `e3b91dc4` | Tests d'essai 15 jours, changement de formule et expiration validés ; CI verte |
| 21–22/11/2026 — PR #117 / HEAD `ba756d09` | Branche synchronisée avec main ; test dépense/isolation ajouté ; CI actuelle en cours |
| 21–22/11/2026 — PR #130 / HEAD `1075c737` | Contraste montants, badges, dégradés et focus corrigés ; CI actuelle en cours |
| 21/11/2026 — PR #126 | Tests du lecteur et capture locale verts ; MP4 final absent du dépôt |

Ce plan doit être mis à jour à chaque nouveau résultat CI, sans transformer une étape « en cours » en étape « validée ».
