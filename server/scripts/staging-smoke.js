#!/usr/bin/env node
'use strict';

// Contrôles HTTP strictement non destructifs pour un environnement de préproduction.
// Ce script ne crée aucun compte, aucune facture et aucune autre donnée.
const BASE_URL = String(process.env.SAMAFACTURE_BASE_URL || '').trim();
const ALLOW_HTTP = process.env.ALLOW_HTTP_STAGING === 'true';
const TIMEOUT_MS = 10000;

let failures = 0;

function report(ok, label, detail = '') {
  const prefix = ok ? 'OK' : 'ECHEC';
  process.stdout.write(prefix + '  ' + label + (detail ? ' — ' + detail : '') + '\n');
  if (!ok) failures++;
}

async function get(path, headers = {}) {
  return fetch(new URL(path, BASE_URL), {
    method: 'GET',
    headers: { Accept: 'application/json, text/html', ...headers },
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
}

async function run() {
  if (!BASE_URL) {
    report(false, 'SAMAFACTURE_BASE_URL', 'définir l’URL HTTPS de staging');
    return;
  }

  let parsed;
  try {
    parsed = new URL(BASE_URL);
  } catch (_) {
    report(false, 'URL de staging', 'URL invalide');
    return;
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash ||
      parsed.pathname !== '/') {
    report(false, 'URL de staging', 'fournir uniquement une origine, sans identifiants, chemin, query ni fragment');
    return;
  }
  if (parsed.protocol !== 'https:' && !(ALLOW_HTTP && parsed.protocol === 'http:')) {
    report(false, 'Transport HTTPS', 'HTTPS obligatoire ; HTTP uniquement avec ALLOW_HTTP_STAGING=true pour un test local isolé');
    return;
  }

  try {
    const health = await get('/api/health');
    const healthBody = await health.json().catch(() => ({}));
    report(
      health.status === 200 && healthBody.status === 'ok',
      'Liveness /api/health',
      'HTTP ' + health.status
    );

    const ready = await get('/api/ready');
    const readyBody = await ready.json().catch(() => ({}));
    const redisExpected = Boolean(process.env.EXPECT_STAGING_REDIS === 'true');
    const redisOk = !redisExpected || readyBody.redis === 'up';
    report(
      ready.status === 200 && readyBody.status === 'ready' &&
        readyBody.database === 'up' && redisOk,
      'Readiness /api/ready',
      'HTTP ' + ready.status + ', MySQL=' + (readyBody.database || 'inconnu') +
        (redisExpected ? ', Redis=' + (readyBody.redis || 'inconnu') : '')
    );

    const homepage = await get('/');
    const contentType = homepage.headers.get('content-type') || '';
    report(
      homepage.status === 200 && contentType.includes('text/html'),
      'Frontend /',
      'HTTP ' + homepage.status + ', Content-Type=' + (contentType || 'absent')
    );

    const protectedRoute = await get('/api/clients?limite=1');
    report(
      protectedRoute.status === 401,
      'Protection API sans jeton',
      'GET /api/clients doit répondre HTTP 401 ; obtenu HTTP ' + protectedRoute.status
    );

    const token = String(process.env.SAMAFACTURE_STAGING_TOKEN || '').trim();
    if (token) {
      const session = await get('/api/auth/me', { Authorization: 'Bearer ' + token });
      const sessionBody = await session.json().catch(() => ({}));
      report(
        session.status === 200 && Boolean(sessionBody.user),
        'Session propriétaire de recette',
        'GET /api/auth/me — HTTP ' + session.status
      );
    } else {
      process.stdout.write('INFO  Authentification positive ignorée — SAMAFACTURE_STAGING_TOKEN non fourni.\n');
    }
  } catch (err) {
    report(false, 'Accès à staging', err && err.name === 'TimeoutError'
      ? 'délai de réponse dépassé'
      : (err.message || 'erreur réseau'));
  }

  process.stdout.write('\n');
  if (failures) {
    process.stderr.write(failures + ' contrôle(s) en échec. Ne pas valider la préproduction.\n');
    process.exitCode = 1;
  } else {
    process.stdout.write('Contrôles de base terminés. La recette métier manuelle reste obligatoire.\n');
  }
}

run().catch(err => {
  process.stderr.write('Erreur inattendue du script de recette : ' + (err.message || err) + '\n');
  process.exitCode = 1;
});
