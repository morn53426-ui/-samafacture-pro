'use strict';

require('dotenv').config();
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const puppeteer = require('puppeteer');

const EMAIL = process.env.SUNUPILOT_DEMO_EMAIL || 'demo.video@sunupilot.test';
const PASSWORD = process.env.SUNUPILOT_DEMO_PASSWORD;
const BASE_URL = process.env.SUNUPILOT_CAPTURE_URL || 'http://localhost:4000';
const OUTPUT_DIR = process.env.SUNUPILOT_CAPTURE_DIR ||
  path.join(os.tmpdir(), 'sunupilot-video-captures');
const CONFIRM = process.env.SUNUPILOT_CAPTURE_CONFIRM;

const PAGES = [
  { name: '01-dashboard', path: '/dashboard.html', ready: '#stats-grid' },
  { name: '02-facturation', path: '/factures.html', ready: '#billing-stats' },
  { name: '03-devis', path: '/devis.html', ready: '#devis-body' },
  { name: '04-clients', path: '/clients.html', ready: '#clients-body' },
  { name: '05-rapports', path: '/rapports.html', ready: '#rec-recettes' }
];

function validateConfig() {
  let url;
  try { url = new URL(BASE_URL); } catch (_) {
    throw new Error('SUNUPILOT_CAPTURE_URL doit être une URL locale valide.');
  }
  const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  if (!localHosts.has(url.hostname) || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Sécurité : la capture est autorisée uniquement sur localhost / loopback.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('SUNUPILOT_CAPTURE_URL ne doit contenir ni identifiants, ni query, ni fragment.');
  }
  if (EMAIL !== 'demo.video@sunupilot.test') throw new Error('Sécurité : seule l’adresse fictive demo.video@sunupilot.test peut être utilisée.');
  if (!PASSWORD) throw new Error('Définissez SUNUPILOT_DEMO_PASSWORD avec le mot de passe généré par le seed.');
  if (CONFIRM !== 'SUNUPILOT_LOCAL_CAPTURE_ONLY') {
    throw new Error('Confirmez la capture locale avec SUNUPILOT_CAPTURE_CONFIRM=SUNUPILOT_LOCAL_CAPTURE_ONLY.');
  }
  return url.origin;
}

function assertLocalPage(page, expectedOrigin) {
  const current = new URL(page.url());
  if (current.origin !== expectedOrigin) {
    throw new Error('Sécurité : navigation hors du serveur local détectée. Capture annulée.');
  }
}

async function waitForPage(page, selector) {
  await page.waitForSelector(selector, { visible: true, timeout: 15000 });
  await page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 });
  await new Promise(resolve => setTimeout(resolve, 1500));
}

async function main() {
  const origin = validateConfig();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const errors = [];
  const captures = [];
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(15000);
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    page.on('pageerror', error => errors.push({ type: 'pageerror', message: String(error.message).slice(0, 300) }));
    page.on('console', message => {
      if (message.type() === 'error') errors.push({ type: 'console', message: message.text().slice(0, 300) });
    });

    await page.goto(origin + '/login.html', { waitUntil: 'domcontentloaded' });
    assertLocalPage(page, origin);
    await page.waitForSelector('#login-form');
    await page.locator('#email').fill(EMAIL);
    await page.locator('#password').fill(PASSWORD);
    await page.locator('#login-form button[type="submit"]').click();
    await page.waitForFunction(
      () => !location.pathname.endsWith('/login.html') &&
        Boolean(localStorage.getItem('sf_token')),
      { timeout: 20000 }
    );

    for (const item of PAGES) {
      await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
      const response = await page.goto(origin + item.path, { waitUntil: 'domcontentloaded' });
      if (!response || !response.ok()) {
        throw new Error('La page ' + item.path + ' a répondu avec une erreur HTTP.');
      }
      assertLocalPage(page, origin);
      await waitForPage(page, item.ready);
      const destination = path.join(OUTPUT_DIR, item.name + '-1920x1080.png');
      await page.screenshot({ path: destination, type: 'png' });
      captures.push({ file: destination, page: item.path, viewport: '1920x1080' });
    }

    const mobilePages = [
      { name: '06-dashboard-mobile', path: '/dashboard.html', ready: '#stats-grid' },
      { name: '07-facturation-mobile', path: '/factures.html', ready: '#billing-stats' }
    ];
    for (const item of mobilePages) {
      await page.setViewport({
        width: 390, height: 844, deviceScaleFactor: 1, isMobile: true,
        hasTouch: true, isLandscape: false
      });
      const response = await page.goto(origin + item.path, { waitUntil: 'domcontentloaded' });
      if (!response || !response.ok()) {
        throw new Error('La page mobile ' + item.path + ' a répondu avec une erreur HTTP.');
      }
      assertLocalPage(page, origin);
      await waitForPage(page, item.ready);
      const destination = path.join(OUTPUT_DIR, item.name + '-390x844.png');
      await page.screenshot({ path: destination, type: 'png', fullPage: true });
      captures.push({ file: destination, page: item.path, viewport: '390x844' });
    }

    const report = {
      product: 'Sunupilot',
      source: 'local authenticated demo account',
      generatedAt: new Date().toISOString(),
      outputDirectory: OUTPUT_DIR,
      captures,
      errors
    };
    fs.writeFileSync(path.join(OUTPUT_DIR, 'capture-report.json'), JSON.stringify(report, null, 2));
    console.log('Captures Sunupilot terminées : ' + captures.length);
    console.log('Dossier local : ' + OUTPUT_DIR);
    console.log('Rapport : ' + path.join(OUTPUT_DIR, 'capture-report.json'));
    if (errors.length) {
      console.warn('Avertissement : ' + errors.length + ' erreur(s) navigateur. Consultez capture-report.json.');
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error('Échec de la capture Sunupilot : ' + error.message);
  process.exitCode = 1;
});
