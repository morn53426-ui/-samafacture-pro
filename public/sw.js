// v2 : force la purge du cache v1, qui pouvait contenir des pages HTML avec une CSP obsolète
// mise en cache par erreur (voir correctif du fetch handler plus bas).
const CACHE_NAME = 'samafacture-shell-v3';

// Fichiers statiques de l'interface (l'API n'est jamais mise en cache : les données doivent
// toujours être à jour).
const SHELL_FILES = [
  '/css/style.css',
  '/js/api.js',
  '/js/sidebar.js',
  '/js/auth-slider.js',
  '/js/landing-slider.js',
  '/manifest.json',
  '/images/icon-192.png',
  '/images/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
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
