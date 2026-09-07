# SamaFacture Pro — App iOS / Android (Capacitor)

Ce dossier enveloppe votre site web existant (`public/`) dans une vraie app native, sans
réécrire le code. Le principe : l'app installée sur le téléphone ouvre directement votre
site en ligne (`https://votredomaine.com`) dans une coquille native — vous continuez à
mettre à jour votre site normalement, l'app se met à jour toute seule (pas besoin de
republier sur les stores à chaque changement de contenu).

## Ce qu'il vous faut

- **Node.js** installé sur votre machine (accès réseau nécessaire — impossible à faire
  dans l'environnement où cet audit a été réalisé).
- **Pour iOS** : un Mac avec Xcode installé (gratuit sur le Mac App Store), et un compte
  développeur Apple (99 $/an) pour publier sur l'App Store.
- **Pour Android** : Android Studio (Windows/Mac/Linux), et un compte développeur Google
  Play (25 $, paiement unique).

## Étape 1 — Configurer avant de commencer

Avant toute commande, ouvrez `capacitor.config.json` dans ce dossier et modifiez :

- `"appId"` : un identifiant unique inversé, ex. `com.votresociete.samafacture` (ne le
  changez plus une fois l'app publiée — c'est son identité permanente sur les stores).
- `"server.url"` : remplacez `https://votredomaine.com` par le vrai domaine où votre
  serveur est déployé (voir la Phase 10 de `RAPPORT_AUDIT.md` pour le déploiement Docker).

## Étape 2 — Installer et générer les projets natifs

```bash
cd mobile
npm install
npx cap add ios       # génère le dossier ios/ (nécessite un Mac)
npx cap add android    # génère le dossier android/
npx cap sync
```

## Étape 3 — Icônes et écran de démarrage

Les icônes actuelles (`public/images/icon-192.png`, `icon-512.png`,
`icon-maskable-512.png`) sont un bon point de départ mais l'App Store demande une icône
**1024×1024 sans transparence**. Le plus simple :

```bash
npm install -D @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor '#0F1B33' --iconBackgroundColorDark '#0F1B33'
```

(fournissez une icône source haute résolution dans `resources/icon.png` avant de lancer
cette commande — voir la documentation de `@capacitor/assets` pour le détail).

## Étape 4 — Ouvrir et lancer

```bash
npx cap open ios       # ouvre Xcode
npx cap open android   # ouvre Android Studio
```

Depuis Xcode/Android Studio : bouton "Run" pour tester sur un simulateur/émulateur ou un
téléphone connecté en USB, comme n'importe quelle app native.

## Étape 5 — Avant de soumettre aux stores

- **CORS** : comme l'app charge directement votre vrai domaine (`server.url` ci-dessus),
  il n'y a **aucune configuration CORS supplémentaire à faire** — le navigateur intégré
  voit votre site comme si c'était un onglet normal sur ce domaine.
- **HTTPS obligatoire** : `"cleartext": false` dans `capacitor.config.json` bloque le
  HTTP non chiffré — assurez-vous que votre domaine a un certificat TLS valide (voir
  `deploy/nginx.conf.example` dans le dépôt principal) avant de publier.
- **Politique Apple** : Apple examine parfois les apps qui ne font "qu'envelopper un site
  web" (risque de rejet "4.2 Minimum Functionality"). Pour limiter ce risque : gardez le
  bouton d'installation PWA existant en plus (déjà en place), et envisagez d'ajouter au
  moins une fonctionnalité native perçue comme un vrai plus (notifications push,
  utilisation de la caméra pour scanner un reçu, etc.) avant la soumission — Capacitor
  fournit des plugins officiels pour ça (`@capacitor/push-notifications`,
  `@capacitor/camera`) si vous voulez aller plus loin.
- **Politique de confidentialité et permissions** : chaque store demande une fiche
  détaillant les données collectées — vos pages `public/confidentialite.html` et
  `public/conditions.html` existantes sont un bon point de départ, à adapter pour
  mentionner l'app mobile spécifiquement.

## Solution alternative plus simple (déjà en place, gratuite, immédiate)

Sans rien de ce qui précède : votre site est déjà une PWA installable (voir
`public/manifest.json`, `public/sw.js`, bouton "Installer l'application" dans le menu).
Un visiteur iOS/Android peut déjà l'ajouter à son écran d'accueil depuis Safari/Chrome —
icône, plein écran, hors-ligne partiel — sans passer par les stores ni leurs frais/délais.
Capacitor n'est nécessaire que si vous voulez apparaître dans les résultats de recherche
de l'App Store / Google Play.
