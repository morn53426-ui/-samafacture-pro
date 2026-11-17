# 002 — Conditionner les états de survol Entreprise au pointeur fin

- **Statut** : TODO
- **Commit de référence** : `a00f172`
- **Sévérité** : MEDIUM
- **Catégorie** : Accessibilité / interaction tactile
- **Périmètre estimé** : 1 fichier, 10 blocs de règles de survol

## Problème

`public/css/enterprise-workspace.css` contient des règles `:hover` sans media query de capacité. Sur les écrans tactiles, certains navigateurs simulent un survol au toucher et peuvent conserver visuellement cet état après le tap. Le problème apparaît notamment dans la navigation d'entreprise, la barre supérieure, les liens d'actions et les cartes.

Les blocs concernés au commit de référence sont :

- ligne 21 : `.group-section-nav a:hover` (règle combinée avec `:focus-visible`)
- lignes 284-288 : `.app-notification-toggle:hover` et `.app-topbar-logout:hover`
- lignes 292-294 : `.app-topbar-localization:hover`
- lignes 407-411 : `#app-sidebar .nav-item:hover`
- lignes 443-446 : `#app-sidebar .sidebar-logout:hover`
- lignes 524-528 : `.enterprise-module-chip:hover`
- lignes 573-576 : `.enterprise-create-actions-list a:hover`
- lignes 599-603 : `.group-section-nav a:hover` (règle combinée avec `:focus-visible`)
- ligne 871 : `.enterprise-dashboard-card-link:hover`
- lignes 1111-1115 : `.enterprise-console-utility-links a:hover`

Extrait représentatif actuel :

```css
.group-section-nav a:hover,.group-section-nav a:focus-visible{
  background:var(--emerald-light);color:var(--emerald)
}
.group-section-nav a:focus-visible{outline:2px solid var(--emerald);outline-offset:2px}

.enterprise-module-chip:hover {
  border-color: #a9c5de;
  box-shadow: 0 4px 11px rgba(16,52,87,.09);
  transform: translateY(-1px);
}
.enterprise-module-chip:focus-visible {
  outline: 2px solid #2789b8;
  outline-offset: 2px;
}
```

## Cible

Placer les styles de survol uniquement dans `@media (hover: hover) and (pointer: fine)`. Les styles clavier `:focus-visible` doivent rester actifs en dehors de cette media query : scinder les deux sélecteurs combinés plutôt que de conditionner le focus au pointeur.

Modèle attendu pour les règles combinées :

```css
.group-section-nav a:focus-visible {
  background: var(--emerald-light);
  color: var(--emerald);
}

@media (hover: hover) and (pointer: fine) {
  .group-section-nav a:hover {
    background: var(--emerald-light);
    color: var(--emerald);
  }
}
```

Modèle attendu pour un état de survol seul :

```css
@media (hover: hover) and (pointer: fine) {
  .enterprise-module-chip:hover {
    border-color: #a9c5de;
    box-shadow: 0 4px 11px rgba(16,52,87,.09);
    transform: translateY(-1px);
  }
}
```

Appliquer ce modèle aux dix blocs recensés ci-dessus. Pour les règles situées à l'intérieur de `@media (min-width: 901px)` (sidebar repliée), placer la media query de capacité à l'intérieur de la règle desktop existante ou conserver une structure équivalente valide ; ne pas élargir ces sélecteurs au mobile.

## Conventions du dépôt

- Utiliser exactement la détection de capacité `(hover: hover) and (pointer: fine)`, déjà prescrite dans `AGENTS.md` et `.agents/skills/mobile-native/SKILL.md`.
- Conserver les couleurs, ombres, transformations, durées et tokens actuels des états de survol.
- Garder les règles `:focus-visible` et leurs contours accessibles hors de la media query.
- Ne pas remplacer la détection par une largeur d'écran, un user-agent ou un test JavaScript.
- Ne pas supprimer les styles `:active` existants ailleurs dans l'application.

## Étapes

1. Ouvrir `public/css/enterprise-workspace.css` et vérifier que les dix blocs de survol sont toujours présents aux endroits décrits.
2. Entourer chacun des blocs `:hover` par `@media (hover: hover) and (pointer: fine)`.
3. Scinder les règles mixtes `:hover, :focus-visible` aux lignes de référence 21 et 599 ; déplacer uniquement la partie `:hover` dans la media query.
4. Conserver les règles `:focus-visible`, leurs couleurs et leurs contours hors media query.
5. Vérifier qu'aucun `:hover` de ce fichier ne reste non conditionné et qu'aucune règle de focus clavier n'a été supprimée ou rendue conditionnelle.

## Limites

- Ne modifier que `public/css/enterprise-workspace.css`.
- Ne pas faire une migration globale des règles de survol de `public/css/style.css` dans ce changement.
- Ne pas changer les styles `:active`, `:focus`, `:focus-visible`, les espacements ou la structure des composants.
- Si le nombre ou les emplacements des blocs ont changé depuis le commit de référence, arrêter et refaire l'inventaire avant de modifier le fichier.

## Vérification

- **Mécanique** : depuis `server/`, exécuter `npm test`.
- **Visuelle** : depuis `server/`, exécuter `VISUAL_DATASET=worst npm run test:visual` ; contrôler au minimum la navigation et les écrans Entreprise sur les viewports tactiles et desktop de la suite.
- **Pointeur fin** : dans un navigateur avec souris/trackpad, vérifier que les effets de survol restent identiques.
- **Tactile** : sur iPhone et Android physiques, tapoter successivement les liens et boutons concernés ; aucun état de survol ne doit rester collé après le tap.
- **Clavier** : naviguer avec Tab et Maj+Tab ; tous les états `:focus-visible` et contours doivent rester visibles, même quand la media query de pointeur fin ne correspond pas.
- **Terminé lorsque** : les dix blocs sont protégés par la media query, le survol fonctionne à la souris et le focus clavier reste indépendant du type de pointeur.
