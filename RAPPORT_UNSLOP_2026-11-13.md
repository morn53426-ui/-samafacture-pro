# Rapport d'audit et de transformation Unslop — 13 novembre 2026

## Périmètre et direction validée

Toutes les pages publiques et privées de SamaFacture Pro, y compris l'accueil, la connexion et l'inscription. Direction validée : **papier, encre et émeraude**.

- **Produit :** logiciel de gestion commerciale et de facturation pour commerçants, artisans et PME.
- **Caractère :** précis, fiable, calme et accessible.
- **Univers :** documents comptables, papier, encre, registres et références.
- **Moments :** lecture rapide des indicateurs, suivi des règlements et aperçu clair des documents.
- **Signature :** références documentaires en monospace et repère émeraude discret pour les actions et états positifs.

## Audit des signes repérés

| Signe | Emplacement constaté | Décision |
|---|---|---|
| Dégradés multiples | `public/css/style.css` : navigation active, sidebar, KPI et actions du tableau de bord | Surfaces neutres ; l'émeraude est réservée à l'action principale |
| KPI saturés | `.dashboard-kpi.blue/green/purple/amber` | Cartes papier avec bordure fine et marqueur discret |
| Actions rapides arc-en-ciel | `.dashboard-action` | Actions neutres ; une action principale émeraude |
| Palette trop dispersée | Variables `--workspace-blue/purple/cyan/amber` | Palette unifiée ; teintes de statut uniquement à leur usage sémantique |
| Trois familles typographiques | Import Manrope + Inter + JetBrains Mono | IBM Plex Sans pour l'interface et IBM Plex Mono pour références/nombres |
| Titres très lourds | Titres, KPI et en-têtes dans `style.css` | Graisses 500/600 et tracking normal |
| Capitales décoratives | Navigation, repères et bandeaux | Casse phrase et libellés plus descriptifs |
| Halos et flou | Carte d'authentification et panneau de connexion | Suppression des halos et du verre dépoli |
| Mouvement décoratif | Ken Burns et bandeau défilant d'authentification | Suppression ; carrousels photographiques conservés |
| Icônes décoratives IA | `public/js/sidebar.js` et `public/js/auth-slider.js` | Icônes fonctionnelles, retrait des paillettes |
| Titre de bienvenue générique | `public/dashboard.html` et son script | « Tableau de bord » et sous-titre concret |
| Contrôle géométrique imprécis | `server/tests/visual/recette-visuelle.js` | La mesure exclut la barre d'outils volontairement pleine largeur et cible le bloc métier |

## Les neuf passes

1. **Espacement :** zone métier séparée de la barre d'outils pleine largeur ; retrait intérieur vérifiable ; navigation compacte conservée.
2. **Couleur :** papier `#F7F4EE`, surface `#FFFEFC`, encre `#24211D`, accent `#087A57`. Le contraste de l'émeraude sur le papier est supérieur à 4,5:1.
3. **Icônes :** jeu SVG existant conservé, tailles homogènes ; icônes IA purement décoratives remplacées.
4. **Copy :** suppression de la salutation du tableau de bord ; reformulation des titres d'accueil et de connexion ; retrait de la promesse « devis illimités » non vérifiée du balisage SEO.
5. **Typographie :** IBM Plex Sans et IBM Plex Mono ; nombres et références tabulaires.
6. **Mise en page :** surfaces neutres, KPI compacts, actions rapides rationalisées ; photos existantes de l'accueil et de l'authentification conservées.
7. **Détails :** rayons et bordures unifiés, ombres discrètes, badges simplifiés.
8. **Visuels :** aucune illustration artificielle ajoutée ; graphiques et photographies existants conservés, couleurs du graphique calmées.
9. **Mouvement :** suppression du Ken Burns et du bandeau animé décoratif ; carrousels et interactions utiles conservés.

## Recette finale — 13 novembre 2026

**Pipeline GitHub Actions final : réussi** — run `43441977236`, commit `3c430f1299774bfbeca72cbccc91db0c4450e9f8`.

- Construction de l'image Docker : réussie.
- Validation Docker Compose et des chemins de configuration : réussie.
- Suite fonctionnelle : **194 tests réussis, 0 échec, 0 test ignoré**, 30 suites.
- Recette visuelle responsive : réussie sur le jeu de données extrême aux largeurs **320, 390, 768 et 1440 px**.
- Captures : **70 PNG** : 15 pages de l'application × 4 largeurs (60), accueil et connexion × 4 largeurs (8), et 2 captures de contrôle.
- Débordement horizontal : **0** sur les 68 combinaisons de pages et de largeurs.
- Thème sombre : fond `rgb(29, 28, 24)`, carte `rgb(40, 39, 32)`, texte `rgb(243, 239, 230)`, contraste mesuré **14,86:1**, sans débordement.
- Navigation desktop compacte (rail 76 px), dépliage/repliage et préférence persistée : réussis.
- Navigation tablette/mobile, recherche globale et notifications : réussies.
- Graphiques et respect de `prefers-reduced-motion` : vérifiés.
- Parcours de création de facture et de devis, calcul de remise, TVA et livraison : réussis ; total de contrôle fictif : 20 380.

La première recette avait révélé un défaut du sélecteur de mesure qui prenait la barre d'outils pleine largeur pour le premier bloc intérieur. Le sélecteur a été corrigé pour cibler le premier bloc métier ; les captures finales confirment que le contenu reste dégagé du rail.

Les captures utilisent des réponses API fictives de recette ; aucune donnée réelle n'est utilisée. L'artefact `samafacture-recette-visuelle-226` contient les 70 PNG et le fichier `rapport-recette-visuelle.json`.

**Packaging final** : workflow `43441977202` réussi pour le même commit. L'archive source est construite à partir des fichiers suivis par Git ; les fichiers `.env` locaux et secrets sont exclus.

La PR #15 reste ouverte et non fusionnée ; la branche `main` n'a pas été modifiée.

## Limites et sécurité

Aucune migration SQL, API, donnée utilisateur, formule de calcul, intégration de paiement ou permission n'a été modifiée volontairement. Les archives de distribution doivent exclure les fichiers `.env` réels et identifiants.

## Attribution

Adaptation du workflow et des références du skill **Unslop** de Damir Sokolovsky, sous licence **Creative Commons Attribution 4.0 International (CC BY 4.0)**. Cette adaptation conserve l'attribution et le lien vers le projet source :

https://github.com/heydamir/unslop

Licence : https://creativecommons.org/licenses/by/4.0/
