// v6 : actualise le shell partagé pour servir la navigation et l'identité Sunupilot corrigées.
const CACHE_NAME = 'sunupilot-shell-v6';

// Fichiers statiques de l'interface (l'API n'est jamais mise en cache : les données doivent
// toujours être à jour).
const SHELL_FILES = [
  '/css/style.css',
  '/js/api.js',
  '/js/sidebar.js',
  '/js/auth-slider.js',
  '/js/pwa.js',
  '/js/landing-slider.js',
  '/manifest.json',
  '/images/icon-192.png',
  '/images/icon-512.png',
  '/images/icon-maskable-512.png',
  '/images/sunupilot-mark.svg'
];

self.addEventListener('install', (event) => {
  // L'installation échoue si une ressource du shell manque : mieux vaut conserver l'ancien
  // service worker actif que d'activer silencieusement un cache incomplet.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Attendre à la fois le nettoyage des anciens caches et la prise de contrôle des clients.
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ne jamais intercepter les appels à l'API : les données doivent toujours venir du serveur.
  if (url.pathname.startsWith('/api/')) return;
  // Seules les requêtes GET sont mises en cache.
  if (event.request.method !== 'GET') return;
  // 🐛 Correctif : cette condition ne couvrait avant que /api/ — le fetch handler interceptait
  // donc AUSSI les pages HTML (factures.html, etc.) et les mettait en cache comme n'importe quel
  // autre GET. Or une Response mise en cache conserve ses en-têtes d'origine, y compris
  // Content-Security-Policy : après un déploiement changeant la CSP côté serveur, les
  // utilisateurs continuaient de recevoir en priorité (cache-first) une page HTML avec l'ANCIENNE
  // CSP figée dans le cache, d'où des erreurs console qui ne correspondaient plus au code serveur
  // actuel. Seul le "shell" applicatif (CSS/JS/icônes listés ci-dessus) doit être mis en cache ;
  // tout le reste — en particulier les documents HTML — doit toujours venir du réseau.
  if (!SHELL_FILES.includes(url.pathname)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
