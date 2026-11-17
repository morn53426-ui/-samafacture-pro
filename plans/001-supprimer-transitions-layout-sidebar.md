# 001 — Supprimer les transitions de layout de la barre latérale

- **Statut** : TODO
- **Commit de référence** : `a00f172`
- **Sévérité** : MEDIUM
- **Catégorie** : Performance / animation
- **Périmètre estimé** : 1 fichier, 2 déclarations CSS

## Problème

Dans `public/css/style.css:4032-4039`, l'ouverture et la fermeture de la sidebar animent deux propriétés qui déclenchent un recalcul de mise en page : `margin-left` sur le contenu principal et `width` sur la sidebar. Le changement de largeur est utile à l'état du composant ; animer ces propriétés à chaque bascule n'est pas nécessaire et ajoute du travail de layout pendant toute la transition.

Code actuel :

```css
@media (min-width: 901px) {
  .main-content { margin-left: var(--sidebar-w); transition: margin-left .2s ease; }
  .sidebar { width: var(--sidebar-w); transition: width .2s ease; }
  .sidebar-collapse-toggle { display: inline-flex; }
  .mobile-toggle { display: none; }

  body.sidebar-collapsed .main-content { margin-left: var(--sidebar-collapsed-w); }
  .sidebar.is-collapsed { width: var(--sidebar-collapsed-w); }
}
```

## Cible

Supprimer uniquement les deux déclarations `transition`. Conserver les valeurs et les sélecteurs de largeur/marge, afin que la géométrie finale reste identique mais que le changement d'état ne soit plus animé sur des propriétés de layout.

```css
@media (min-width: 901px) {
  .main-content { margin-left: var(--sidebar-w); }
  .sidebar { width: var(--sidebar-w); }
  .sidebar-collapse-toggle { display: inline-flex; }
  .mobile-toggle { display: none; }

  body.sidebar-collapsed .main-content { margin-left: var(--sidebar-collapsed-w); }
  .sidebar.is-collapsed { width: var(--sidebar-collapsed-w); }
}
```

Ne pas remplacer ces transitions par une animation de `transform` sur le conteneur : le but de ce changement est de rendre la bascule fréquente immédiate, pas de déplacer visuellement le contenu.

## Conventions du dépôt

- Conserver les variables existantes `--sidebar-w` et `--sidebar-collapsed-w`.
- Garder la règle dans la media query desktop existante `@media (min-width: 901px)`.
- Ne pas toucher au JavaScript de bascule, aux largeurs, aux espacements, ni au comportement de la navigation mobile.

## Étapes

1. Ouvrir `public/css/style.css` et confirmer que les deux déclarations correspondent toujours à l'extrait ci-dessus.
2. Retirer `transition: margin-left .2s ease` de `.main-content`.
3. Retirer `transition: width .2s ease` de `.sidebar`.
4. Vérifier qu'aucune autre règle ne réintroduit une transition de `margin-left` ou `width` pour ces deux sélecteurs.
5. Comparer les états déplié/replié pour vérifier que les mêmes dimensions finales sont conservées.

## Limites

- Ne modifier que `public/css/style.css`.
- Ne pas modifier les calculs, les classes, les attributs ARIA, les événements ou la structure HTML.
- Ne pas supprimer la prise en charge de `prefers-reduced-motion`.
- Si le code a changé depuis le commit de référence et que les règles ne correspondent plus, arrêter et signaler le décalage au lieu d'improviser.

## Vérification

- **Mécanique** : depuis `server/`, exécuter `npm test` (script existant : `node --test "tests/*.test.js"`).
- **Visuelle** : depuis `server/`, exécuter `VISUAL_DATASET=worst npm run test:visual` et contrôler la sidebar aux largeurs desktop couvertes par la suite.
- **Contrôle manuel** : basculer plusieurs fois la sidebar, vérifier l'alignement du contenu, l'absence de chevauchement et l'état actif des liens. Vérifier également que le menu mobile n'est pas affecté.
- **Mouvement réduit** : activer `prefers-reduced-motion: reduce` et confirmer qu'aucun déplacement animé de la sidebar n'a été ajouté.
- **Terminé lorsque** : les états replié/déplié conservent leur géométrie, sans transition de largeur ou de marge sur les deux conteneurs.
