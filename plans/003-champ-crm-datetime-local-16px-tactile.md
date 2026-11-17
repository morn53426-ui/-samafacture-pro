# 003 — Appliquer 16 px au champ de rappel CRM sur écran tactile

- **Statut** : TODO
- **Commit de référence** : `a00f172`
- **Sévérité** : MEDIUM
- **Catégorie** : Mobile / formulaire
- **Périmètre estimé** : 1 fichier CSS, 1 sélecteur à ajouter

## Problème

Le formulaire CRM utilise `input#due_at[type="datetime-local"]` dans `public/crm.html:31`. La taille de base des champs est inférieure à 16 px (`public/css/style.css:4162-4169`, `font-size: .91rem`), et la media query tactile existante ne cible pas `datetime-local` (`public/css/style.css:1544-1549`). Sur iOS Safari, un champ dont le texte est inférieur à 16 px peut déclencher un zoom automatique lors du focus.

Code actuel :

```css
@media (pointer: coarse) {
  input[type=text], input[type=email], input[type=password], input[type=number],
  input[type=date], input[type=tel], input[type=search], input[type=url],
  select, textarea {
    font-size: 16px !important;
  }
}
```

Le champ concerné :

```html
<div class="field"><label for="due_at">Date de rappel (facultative)</label><input id="due_at" type="datetime-local"></div>
```

## Cible

Ajouter uniquement `input[type=datetime-local]` à la liste des contrôles déjà concernés par la règle tactile.

```css
@media (pointer: coarse) {
  input[type=text], input[type=email], input[type=password], input[type=number],
  input[type=date], input[type=datetime-local], input[type=tel], input[type=search], input[type=url],
  select, textarea {
    font-size: 16px !important;
  }
}
```

Ne pas désactiver le zoom utilisateur et ne pas ajouter `maximum-scale=1` ou `user-scalable=no`.

## Conventions du dépôt

- Réutiliser la media query existante `@media (pointer: coarse)`.
- Garder la règle à 16 px et le `!important` existant, afin de surcharger la taille de formulaire déclarée plus bas dans la feuille.
- Le skill mobile du dépôt impose la correction par taille de police, jamais par restriction du zoom.
- Ne pas modifier le HTML du formulaire CRM : son identifiant et son type de champ sont déjà corrects.

## Étapes

1. Confirmer dans `public/crm.html` que le champ `#due_at` est toujours un `input[type="datetime-local"]`.
2. Confirmer que le bloc tactile de `public/css/style.css` ne contient toujours pas ce type.
3. Ajouter `input[type=datetime-local]` à la liste du bloc `@media (pointer: coarse)`.
4. Ne modifier aucune autre règle de taille de police et ne pas restreindre le zoom utilisateur.

## Limites

- Ne modifier que `public/css/style.css`.
- Ne pas modifier `public/crm.html`, les attributs du champ, les scripts CRM ou la validation métier.
- Ne pas appliquer 16 px à tous les champs desktop.
- Si le champ ou le bloc responsive a changé depuis le commit de référence, arrêter et réévaluer le sélecteur utile.

## Vérification

- **Mécanique** : depuis `server/`, exécuter `npm test`.
- **Visuelle** : depuis `server/`, exécuter `VISUAL_DATASET=worst npm run test:visual` pour détecter une régression de mise en page.
- **iPhone physique** : ouvrir la page CRM dans Safari, toucher le champ Date de rappel et vérifier que la page ne zoome pas automatiquement ; vérifier ensuite que la navigation et le zoom manuel restent disponibles.
- **Android physique** : ouvrir le même formulaire, afficher le clavier date/heure et vérifier la lisibilité du champ et l'absence de débordement.
- **Limite de validation** : les tests Chromium CI et l'émulation mobile ne remplacent pas ces essais matériels. Ne déclarer le correctif mobile terminé qu'après contrôle sur téléphone physique.
- **Terminé lorsque** : le champ ciblé calcule une taille de police d'au moins 16 px avec un pointeur tactile, sans restriction du zoom utilisateur.
