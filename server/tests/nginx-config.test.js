const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Nginx déclare ip_hash avant keepalive pour conserver le routage sticky', () => {
  const config = fs.readFileSync(
    path.join(__dirname, '..', '..', 'deploy', 'nginx.scalable.conf.example'),
    'utf8'
  );
  const upstream = config.match(/upstream\s+samafacture_api\s*\{([\s\S]*?)\n\s*\}/);
  assert.ok(upstream, 'le groupe upstream samafacture_api doit exister');

  const hashIndex = upstream[1].indexOf('ip_hash;');
  const keepaliveIndex = upstream[1].indexOf('keepalive 32;');
  assert.ok(hashIndex >= 0, 'ip_hash doit être activé pour les sessions Socket.IO sticky');
  assert.ok(keepaliveIndex >= 0, 'keepalive doit rester activé');
  assert.ok(hashIndex < keepaliveIndex, 'ip_hash doit précéder keepalive pour éviter le warning Nginx');
});
