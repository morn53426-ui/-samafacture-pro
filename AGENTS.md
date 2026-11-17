# Instructions pour les agents — Sama Facture Pro

Ces instructions s'appliquent à tout agent qui modifie ce dépôt. Les skills référencés ci-dessous sont versionnés dans `.agents/skills/` et doivent être lus avant d'intervenir sur l'interface concernée.

## Contexte du projet

- Application web SaaS principalement construite avec HTML, CSS et JavaScript, backend Node.js et base MySQL.
- Le dossier `mobile/` contient l'enveloppe Capacitor iOS/Android qui charge l'application web.
- Les variables et composants existants dans `public/css/style.css` constituent la référence visuelle. Étendre les tokens présents avant de créer une nouvelle échelle.
- Une modification d'interface ne doit pas changer les calculs de facturation, les soldes, les règles comptables OHADA, les contrats API ou les contrôles de sécurité sans demande explicite et tests dédiés.

## Skills à appliquer selon le travail

1. **Construction ou revue d'une interface / interaction** : lire `.agents/skills/emil-design-eng/SKILL.md`. Pour toute revue de code UI, utiliser le tableau `Before | After | Why` exigé par ce skill.
2. **Écran affichant des données variables** (clients, entreprises, factures, tableaux, listes, compteurs, badges) : lire `.agents/skills/break-ui/SKILL.md` et `CATALOG.md`. Les cas limites doivent être plausibles ou basés sur les limites des schémas/API. Couvrir aussi les états vide, un élément et les grandes collections lorsque pertinent. Injecter les fixtures à la frontière des données, jamais en bricolant le DOM ou le CSS. Les sélecteurs de démonstration restent réservés au développement.
3. **Parcours tactile, responsive, PWA ou Capacitor** : lire `.agents/skills/mobile-native/SKILL.md`. Ne jamais désactiver le zoom utilisateur. Un contrôle par émulation n'est pas un essai matériel : tester sur téléphone physique avant de déclarer un correctif mobile terminé, ou préciser explicitement ce qui reste à vérifier.
4. **Modification ou revue d'animations** : lire `.agents/skills/review-animations/SKILL.md` et `STANDARDS.md`. Justifier chaque mouvement par son objectif et sa fréquence ; respecter `prefers-reduced-motion` ; privilégier `transform` et `opacity` ; éviter les animations d'actions clavier ou très fréquentes.
5. **Audit global des animations** : lire `.agents/skills/improve-animations/SKILL.md`, `AUDIT.md` et `PLAN-TEMPLATE.md`. Cet audit est en lecture seule sur le code source : consigner les constats précis et proposer des plans autonomes, puis attendre la sélection des corrections avant de modifier les sources.
6. **Formalisation des préférences de conception exprimées par l'utilisateur** : lire `.agents/skills/learn-taste/SKILL.md` uniquement lorsque ce travail est demandé. Respecter le processus « proposer puis attendre l'approbation » ; ne jamais transformer une préférence supposée en règle durable.

## Garde-fous de conception et de qualité

- Préserver la cohérence des icônes SVG, de la typographie, des espacements, des couleurs et des ombres existantes.
- Conditionner les états `:hover` à `(hover: hover) and (pointer: fine)` lorsqu'ils ne conviennent pas au tactile ; conserver un retour `:active` pour les contrôles pressables.
- Sur pointeur tactile, empêcher le zoom automatique iOS des champs avec une taille de police d'au moins 16 px ; ne jamais contourner ce problème avec `user-scalable=no` ou `maximum-scale=1`.
- Utiliser les unités de viewport dynamiques et les `safe-area-inset-*` lorsque le contenu suit la fenêtre mobile visible ou doit éviter l'encoche.
- Ne pas animer une propriété qui déclenche inutilement le layout ou le paint. Ne pas ajouter un mouvement uniquement décoratif à une action répétée.
- Les animations d'entrée/sortie doivent rester interrompables lorsque l'état peut changer rapidement ; les modales restent centrées, les popovers partent de leur déclencheur.
- Vérifier clavier, focus visibles, libellés accessibles, contraste et préférence de réduction des animations.
- Les factures et devis doivent être contrôlés à l'écran ET en impression/PDF. Une capture responsive ne remplace pas une vérification du rendu imprimé.

## Vérifications avant validation

- Exécuter les tests Node du dossier `server/` ainsi que les vérifications ESLint et workflows correspondants.
- Pour une page métier, contrôler 320 px, les largeurs intermédiaires et desktop, un zoom 200 %, les libellés longs, champs absents, états vides, compteurs importants et textes traduits.
- Pour les changements tactiles, faire un essai iOS ou Android physique avant l'approbation finale.
- Pour les documents, contrôler marges, sauts de page, colonnes, totaux, en-têtes/pieds et lisibilité du PDF.
- Ne jamais annoncer « validé » pour un contrôle qui n'a pas réellement été exécuté.