'use strict';

const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

const CONFIG_PATH = path.join(__dirname, '..', 'capacitor.config.json');
const MOBILE_DIR = path.resolve(__dirname, '..');

function isPrivateAddress(hostname) {
  const ipVersion = net.isIP(hostname);
  if (ipVersion === 4) {
    const octets = hostname.split('.').map(Number);
    const [a, b] = octets;
    return a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19));
  }
  if (ipVersion === 6) {
    const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return normalized === '::' || normalized === '::1' ||
      normalized.startsWith('fc') || normalized.startsWith('fd') ||
      normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
      normalized.startsWith('fea') || normalized.startsWith('feb');
  }
  return false;
}

function validateCapacitorConfig(config, options = {}) {
  const errors = [];
  const mobileDir = options.mobileDir || MOBILE_DIR;

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return ['Le fichier Capacitor doit contenir un objet JSON.'];
  }

  if (typeof config.appId !== 'string' ||
      !/^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9_-]+)+$/.test(config.appId)) {
    errors.push('appId doit être un identifiant de type domaine inversé (ex. com.samafacturepro.app).');
  }

  if (typeof config.appName !== 'string' || !config.appName.trim()) {
    errors.push('appName doit contenir le nom de l’application.');
  }

  if (typeof config.webDir !== 'string' || !config.webDir.trim()) {
    errors.push('webDir doit désigner le dossier contenant les ressources web.');
  } else {
    const webDir = path.resolve(mobileDir, config.webDir);
    if (!fs.existsSync(webDir) || !fs.statSync(webDir).isDirectory()) {
      errors.push('webDir ne pointe pas vers un dossier existant : ' + config.webDir);
    }
  }

  if (config.server?.cleartext !== false) {
    errors.push('server.cleartext doit être false : le trafic HTTP non chiffré est interdit.');
  }

  let serverUrl;
  if (typeof config.server?.url !== 'string' || !config.server.url.trim()) {
    errors.push('server.url doit contenir le domaine HTTPS réel de l’application.');
  } else {
    try {
      serverUrl = new URL(config.server.url);
    } catch (_) {
      errors.push('server.url n’est pas une URL valide.');
    }
  }

  if (serverUrl) {
    const hostname = serverUrl.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
    const ipVersion = net.isIP(hostname);
    const placeholder = /(^|\.)(votredomaine\.com|example\.com|example\.org|example\.net|example\.invalid|invalid|test)$/i.test(hostname);
    const localHost = hostname === 'localhost' || hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') || hostname.endsWith('.internal');
    if (!hostname.includes('.') || hostname.startsWith('.')) {
      errors.push('server.url doit utiliser un nom de domaine public complet.');
    }
    if (ipVersion !== 0 && !isPrivateAddress(hostname)) {
      errors.push('server.url doit utiliser un nom de domaine DNS public, pas une adresse IP.');
    }
    if (serverUrl.protocol !== 'https:') {
      errors.push('server.url doit utiliser HTTPS.');
    }
    if (serverUrl.username || serverUrl.password) {
      errors.push('server.url ne doit pas contenir d’identifiants.');
    }
    if (serverUrl.search || serverUrl.hash) {
      errors.push('server.url ne doit pas contenir de paramètres ni de fragment.');
    }
    if (placeholder) {
      errors.push('server.url utilise encore un domaine d’exemple. Configurez le véritable domaine public avant de générer l’application.');
    }
    if (localHost || isPrivateAddress(hostname)) {
      errors.push('server.url ne peut pas cibler localhost, une adresse privée ou un réseau local.');
    }
  }

  return errors;
}

function runPreflight() {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (error) {
    console.error('Impossible de lire mobile/capacitor.config.json : ' + error.message);
    return 1;
  }

  const errors = validateCapacitorConfig(config);
  if (errors.length) {
    console.error('Configuration mobile non prête :');
    for (const error of errors) console.error(' - ' + error);
    console.error('\nCorrigez mobile/capacitor.config.json, puis relancez npm run preflight.');
    return 1;
  }

  console.log('Pré-vérification mobile réussie : HTTPS, domaine public, appId et webDir valides.');
  return 0;
}

if (require.main === module) {
  process.exitCode = runPreflight();
}

module.exports = { validateCapacitorConfig };
