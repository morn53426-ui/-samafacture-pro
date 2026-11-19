'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'manifest.json'), 'utf8'));
const serviceWorker = fs.readFileSync(path.join(PUBLIC_DIR, 'sw.js'), 'utf8');
const pwaScript = fs.readFileSync(path.join(PUBLIC_DIR, 'js/pwa.js'), 'utf8');

function publicFile(relativePath) {
  const absolute = path.resolve(PUBLIC_DIR, relativePath);
  assert.ok(
    absolute.startsWith(PUBLIC_DIR + path.sep),
    'Le chemin doit rester dans public/: ' + relativePath
  );
  assert.ok(fs.existsSync(absolute), 'Ressource PWA absente : ' + relativePath);
  return absolute;
}

function loadServiceWorker({
  cacheNames = ['old-cache', 'sunupilot-shell-v6'],
  onAddAll = async () => {},
  onDelete = async () => true,
  onSkipWaiting = async () => {},
  onClaim = async () => {}
} = {}) {
  const handlers = new Map();
  const events = [];
  const context = {
    Promise,
    URL,
    self: {
      addEventListener(type, listener) {
        handlers.set(type, listener);
      },
      skipWaiting() {
        events.push('skipWaiting');
        return onSkipWaiting();
      },
      clients: {
        claim() {
          events.push('clients.claim');
          return onClaim();
        }
      }
    },
    caches: {
      open(name) {
        events.push('caches.open:' + name);
        return Promise.resolve({
          addAll(files) {
            events.push('cache.addAll');
            return onAddAll(files);
          }
        });
      },
      keys() {
        events.push('caches.keys');
        return Promise.resolve(cacheNames);
      },
      delete(name) {
        events.push('caches.delete:' + name);
        return onDelete(name);
      }
    },
    fetch: async () => ({ status: 200, clone() { return this; } })
  };

  vm.runInNewContext(serviceWorker, context, { filename: 'public/sw.js' });
  return { handlers, events };
}

describe('PWA SUNUPILOT — manifeste, icônes et cache', () => {
  test('le manifeste décrit une application installable dans son propre périmètre', () => {
    assert.equal(manifest.name, 'Sunupilot');
    assert.equal(manifest.short_name, 'Sunupilot');
    assert.equal(manifest.start_url, '/dashboard.html');
    assert.equal(manifest.scope, '/');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.lang, 'fr');
    assert.equal(manifest.theme_color, '#29265E');
    assert.equal(manifest.background_color, '#F6F7F5');
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3);
  });

  test('chaque icône du manifeste existe, possède le bon format et les dimensions annoncées', () => {
    const purposes = new Set();

    for (const icon of manifest.icons) {
      assert.ok(icon.src && !/^https?:/i.test(icon.src), 'Les icônes doivent être servies localement.');
      assert.ok(icon.sizes && icon.type, 'Chaque icône doit déclarer sizes et type.');
      const filePath = publicFile(icon.src);
      purposes.add(icon.purpose || 'any');

      if (icon.type === 'image/png') {
        const png = fs.readFileSync(filePath);
        assert.deepEqual(
          [...png.subarray(0, 8)],
          [137, 80, 78, 71, 13, 10, 26, 10],
          icon.src + ' doit avoir une signature PNG valide.'
        );
        assert.equal(png.toString('ascii', 12, 16), 'IHDR',
          icon.src + ' doit contenir un en-tête PNG IHDR.');
        const width = png.readUInt32BE(16);
        const height = png.readUInt32BE(20);
        assert.equal(width, height, icon.src + ' doit être carré.');
        assert.equal(icon.sizes, width + 'x' + height,
          icon.src + ' doit annoncer ses dimensions réelles.');
      } else if (icon.type === 'image/svg+xml') {
        const svg = fs.readFileSync(filePath, 'utf8');
        assert.match(svg, /<svg\b/i, icon.src + ' doit être un SVG valide.');
        assert.match(svg, /\bviewBox=/i, icon.src + ' doit déclarer un viewBox adaptable.');
        assert.doesNotMatch(svg, /<script\b|<foreignObject\b|(?:href|src)=["']https?:/i,
          icon.src + ' ne doit contenir ni script ni ressource distante.');
      } else {
        assert.fail('Type d’icône non pris en charge : ' + icon.type);
      }
    }

    assert.ok(purposes.has('any'), 'Une icône standard doit être disponible.');
    assert.ok(
      manifest.icons.some(icon => icon.purpose === 'maskable' && icon.sizes === '512x512'),
      'Une icône PNG maskable de 512x512 doit être disponible pour Android.'
    );
  });

  test('le shell précaché ne référence que des ressources existantes et exclut HTML et API', () => {
    const match = serviceWorker.match(/const SHELL_FILES = \[([\s\S]*?)\];/);
    assert.ok(match, 'Le service worker doit déclarer SHELL_FILES.');
    const shellFiles = Array.from(match[1].matchAll(/['"]([^'"]+)['"]/g), item => item[1]);
    assert.ok(shellFiles.length > 0, 'Le shell doit contenir des ressources statiques.');

    for (const resource of shellFiles) {
      assert.ok(resource.startsWith('/') && !resource.startsWith('//'),
        'Chaque ressource du shell doit être une URL locale absolue : ' + resource);
      assert.ok(!/\.html?(?:[?#]|$)/i.test(resource),
        'Les pages HTML ne doivent pas être précachées : ' + resource);
      assert.ok(!resource.startsWith('/api/'),
        'Les données API ne doivent jamais être précachées : ' + resource);
      publicFile(resource.slice(1));
    }

    for (const required of [
      '/css/style.css',
      '/js/api.js',
      '/js/sidebar.js',
      '/js/pwa.js',
      '/manifest.json',
      '/images/icon-192.png',
      '/images/icon-512.png',
      '/images/icon-maskable-512.png',
      '/images/sunupilot-mark.svg'
    ]) {
      assert.ok(shellFiles.includes(required), 'Ressource de marque ou shell absente du cache : ' + required);
    }
  });

  test('le service worker ignore les API et les requêtes non GET et ne met en cache que le shell', () => {
    assert.match(serviceWorker, /const CACHE_NAME = ['"]sunupilot-shell-v\d+['"]/);
    assert.match(serviceWorker, /if \(url\.pathname\.startsWith\(['"]\/api\/['"]\)\) return/);
    assert.match(serviceWorker, /if \(event\.request\.method !== ['"]GET['"]\) return/);
    assert.match(serviceWorker, /if \(!SHELL_FILES\.includes\(url\.pathname\)\) return/);
    assert.match(serviceWorker, /return cached \|\| network/);
    assert.match(serviceWorker, /keys\.filter\(\(k\) => k !== CACHE_NAME\)/,
      'L’activation doit purger les anciennes versions du cache.');
    assert.match(serviceWorker, /self\.skipWaiting\(\)/);
    assert.match(serviceWorker, /self\.clients\.claim\(\)/);
  });

  test('l’installation attend le précache complet avant de prendre le contrôle', async () => {
    let precacheCompleted = false;
    const harness = loadServiceWorker({
      onAddAll: async (files) => {
        assert.ok(files.includes('/js/pwa.js'));
        await Promise.resolve();
        precacheCompleted = true;
      },
      onSkipWaiting: async () => {
        assert.equal(precacheCompleted, true,
          'skipWaiting ne doit être appelé qu’après le précache complet.');
      }
    });
    let installPromise;
    harness.handlers.get('install')({ waitUntil(promise) { installPromise = promise; } });

    await installPromise;

    assert.deepEqual(harness.events, [
      'caches.open:sunupilot-shell-v6',
      'cache.addAll',
      'skipWaiting'
    ]);
  });

  test('un échec du précache fait échouer l’installation sans activer le service worker', async () => {
    const precacheError = new Error('précache incomplet');
    let skipWaitingCalled = false;
    const harness = loadServiceWorker({
      onAddAll: async () => { throw precacheError; },
      onSkipWaiting: async () => { skipWaitingCalled = true; }
    });
    let installPromise;
    harness.handlers.get('install')({ waitUntil(promise) { installPromise = promise; } });

    await assert.rejects(installPromise, precacheError);
    assert.equal(skipWaitingCalled, false);
    assert.ok(!harness.events.includes('skipWaiting'));
  });

  test('l’activation attend le nettoyage des anciens caches et clients.claim', async () => {
    const deletedCaches = [];
    let claimCompleted = false;
    const harness = loadServiceWorker({
      cacheNames: ['old-cache', 'sunupilot-shell-v4', 'sunupilot-shell-v5', 'sunupilot-shell-v6'],
      onDelete: async (name) => {
        deletedCaches.push(name);
        await Promise.resolve();
      },
      onClaim: async () => {
        await Promise.resolve();
        claimCompleted = true;
      }
    });
    let activatePromise;
    harness.handlers.get('activate')({ waitUntil(promise) { activatePromise = promise; } });

    await activatePromise;

    assert.deepEqual(deletedCaches, ['old-cache', 'sunupilot-shell-v4', 'sunupilot-shell-v5']);
    assert.equal(claimCompleted, true);
  });

  test('le script gère l’installation native et enregistre le service worker sans bloquer la page', () => {
    assert.match(pwaScript, /navigator\.serviceWorker\.register\(['"]\/sw\.js['"]\)/);
    assert.match(pwaScript, /\.catch\(\(\) => \{\}\)/);
    assert.match(pwaScript, /beforeinstallprompt/);
    assert.match(pwaScript, /e\.preventDefault\(\)/);
    assert.match(pwaScript, /deferredInstallPrompt\.prompt\(\)/);
    assert.match(pwaScript, /await deferredInstallPrompt\.userChoice/);
    assert.match(pwaScript, /appinstalled/);
  });
});
