const jwt = require('jsonwebtoken');
const { getTokenVersion } = require('./session');

// -----------------------------------------------------------------------------
// Génère un vrai fichier PDF pour une facture, en réutilisant EXACTEMENT le même
// rendu HTML/CSS que la page facture-detail.html (logo, QR code, signature, et les
// 24 modèles existants) plutôt que de réécrire ce rendu une deuxième fois côté serveur
// avec une librairie PDF séparée — ce qui aurait fini par diverger du rendu à l'écran.
//
// Principe : un navigateur headless (Puppeteer) ouvre la vraie page, avec un token
// injecté directement dans son localStorage (donc pas besoin d'exposer la facture sur
// une route publique), attend que la facture soit chargée, puis imprime la page en PDF.
//
// ⚠️ Coût en ressources : Puppeteer embarque Chromium (~300 Mo à l'installation) et
// chaque génération consomme nettement plus de mémoire/CPU qu'une simple requête API.
// Un seul navigateur est lancé et réutilisé (pas un par requête), et le nombre de
// générations simultanées est plafonné ci-dessous pour éviter qu'un pic de demandes
// PDF sature le serveur. Si l'hébergement final est très limité en ressources (petit
// mutualisé), envisager de déplacer cette génération vers un service séparé.
// -----------------------------------------------------------------------------

let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    const puppeteer = require('puppeteer');
    browserPromise = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // nécessaire sur la plupart des hébergements Linux (pas de sandbox système dédié)
    }).then(browser => {
      // Audit final : si Chromium plante APRÈS un lancement réussi (OOM — cas fréquent avec
      // Puppeteer sous charge, crash du process natif...), l'ancien code ne réinitialisait
      // browserPromise qu'en cas d'échec de puppeteer.launch() lui-même. Toute génération PDF
      // suivante réutilisait alors indéfiniment une référence vers un navigateur mort (jusqu'au
      // redémarrage du serveur), sans jamais réessayer d'en relancer un. 'disconnected' est
      // l'événement Puppeteer émis aussi bien sur browser.close() propre que sur un crash —
      // dans les deux cas, le prochain appel à getBrowser() doit repartir d'un lancement propre.
      browser.once('disconnected', () => { browserPromise = null; });
      return browser;
    }).catch(err => {
      browserPromise = null; // permet de réessayer au prochain appel plutôt que de rester bloqué en échec
      throw err;
    });
  }
  return browserPromise;
}

// Limite simple de concurrence : au-delà de MAX_CONCURRENT générations en même temps,
// les suivantes attendent leur tour plutôt que de lancer des pages en parallèle sans limite.
const MAX_CONCURRENT = 3;
// Au-delà de MAX_QUEUE demandes déjà en attente d'un emplacement, on refuse tout de suite
// les suivantes plutôt que de les empiler indéfiniment (même principe que `queueLimit` sur
// le pool MySQL, voir config/db.js) : sous un pic de demandes PDF, mieux vaut un échec 502
// rapide et clair pour les dernières requêtes qu'une file qui grossit sans limite et retarde
// tout le monde.
const MAX_QUEUE = 20;
let enCours = 0;
const attente = [];
async function acquireSlot() {
  if (enCours < MAX_CONCURRENT) { enCours++; return; }
  if (attente.length >= MAX_QUEUE) {
    throw new Error('Trop de générations de PDF en attente, réessayez dans un instant.');
  }
  await new Promise(resolve => attente.push(resolve));
  enCours++;
}
function releaseSlot() {
  enCours--;
  const next = attente.shift();
  if (next) next();
}

async function signerTokenTemporaire(user) {
  // Token à usage unique pour cette génération, durée de vie très courte : uniquement
  // le temps que le navigateur headless charge la page (pas un token de session classique).
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, nom: user.nom, tv: (await getTokenVersion(user.id)) || 0 },
    process.env.JWT_SECRET,
    { expiresIn: '2m' }
  );
}

const HOTES_POLICES_AUTORISES = new Set(['https://fonts.googleapis.com', 'https://fonts.gstatic.com']);

// Règle réseau de la page PDF : application elle-même, data:/blob: et polices Google uniquement.
function urlPdfAutorisee(url, origineApp) {
  try {
    if (url.startsWith('data:') || url.startsWith('blob:') || url === 'about:blank') return true;
    const origine = new URL(url).origin;
    return origine === origineApp || HOTES_POLICES_AUTORISES.has(origine);
  } catch (_) {
    return false;
  }
}

async function genererPdfFacture(factureId, user) {
  await acquireSlot();
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    const token = await signerTokenTemporaire(user);
    const baseUrl = (process.env.PDF_BASE_URL || process.env.APP_URL || 'http://localhost:4000').replace(/\/$/, '');

    // La page PDF peut être servie par un serveur HTTP de test sur un port aléatoire
    // (ou par un reverse-proxy distinct du port API). api.js redirige normalement les
    // navigateurs localhost non-4000 vers :4000 pour éviter Live Server, mais ce comportement
    // est incorrect ici : Puppeteer navigue précisément vers le serveur HTTP de test.
    // On force donc l'URL API à être celle du même serveur que la page avant l'exécution
    // de tout script applicatif. Cela supprime les timeouts PDF dus à des appels API envoyés
    // vers un autre port.
    const apiBaseUrl = `${baseUrl}/api`;

    // Chromium tourne avec --no-sandbox et détient un JWT valide 2 min : on bloque toute requête
    // sortante hors de l'application (et des polices Google), pour qu'un contenu injecté dans une
    // facture ne puisse ni exfiltrer le jeton ni joindre le réseau interne (SSRF).
    const origineApp = new URL(baseUrl).origin;
    await page.setRequestInterception(true);
    page.on('request', (requete) => {
      if (urlPdfAutorisee(requete.url(), origineApp)) requete.continue();
      else requete.abort('blockedbyclient');
    });
    await page.evaluateOnNewDocument((t, apiUrl) => {
      localStorage.setItem('sf_token', t);
      window.SAMAFACTURE_API_URL = apiUrl;
    }, token, apiBaseUrl);

    await page.goto(`${baseUrl}/facture-detail.html?id=${factureId}`, { waitUntil: 'networkidle0', timeout: 20000 });

    // La facture est chargée en JS après la navigation (appel à /api/factures/:id) :
    // on attend le signal explicite window.__docReady plutôt qu'un délai fixe ou un
    // simple test de présence DOM (voir facture-detail.html, fin de la fonction load()).
    await page.waitForFunction(
      () => window.__docReady === true,
      { timeout: 15000 }
    );
    // Réutilise le bloc @media print déjà présent dans facture-detail.html (masque la
    // barre d'outils "Fermer / Imprimer", ajuste les marges) — même mécanisme que le
    // bouton "Imprimer / Exporter en PDF" existant, pas de style dupliqué ici.
    // Capturer le document dans son état final : polices, logo, QR code et autres images
    // doivent être décodés avant l'impression pour éviter les blocs vides ou les sauts tardifs.
    // Le PDF doit conserver la palette papier, indépendamment du thème de l'interface.
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
    });
    await page.emulateMediaType('print');
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const images = Array.from(document.querySelectorAll('#doc img'));
      await Promise.all(images.map(image => {
        if (typeof image.decode === 'function') return image.decode().catch(() => {});
        if (image.complete) return Promise.resolve();
        return new Promise(resolve => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        });
      }));
    });
    await page.evaluate(() => new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    ));

    const pdfData = await page.pdf({
      format: 'A4',
      // Les dimensions et marges A4 sont définies une seule fois dans @page,
      // partagé avec le bouton Imprimer de facture-detail.html.
      preferCSSPageSize: true,
      printBackground: true,
      scale: 1
    });
    // Puppeteer récent renvoie un Uint8Array. Express traite un Uint8Array simple
    // comme un objet JSON (clés 0, 1, 2...) au lieu d'un contenu binaire ; Buffer.from
    // garantit un vrai PDF pour les téléchargements HTTP et les pièces jointes email.
    return Buffer.from(pdfData);
  } finally {
    if (page) await page.close().catch(() => {});
    releaseSlot();
  }
}

// Ferme proprement le navigateur Chromium partagé (s'il a été lancé). À appeler lors de
// l'arrêt propre du serveur/worker, et dans le teardown des tests : sans cet appel, le
// process Chromium reste ouvert indéfiniment (aucun `browser.close()` n'existait avant),
// ce qui empêche le process Node de se terminer proprement et provoque, sous `node --test`,
// des tests suivants annulés en cascade ('Promise resolution is still pending...').
async function closeBrowser() {
  if (!browserPromise) return;
  const promise = browserPromise;
  browserPromise = null;
  try {
    const browser = await promise;
    await browser.close();
  } catch (err) {
    // Le navigateur était peut-être déjà mort/déconnecté — rien à faire de plus.
  }
}

module.exports = { genererPdfFacture, closeBrowser, urlPdfAutorisee };
