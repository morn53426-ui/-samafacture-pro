#!/usr/bin/env node
'use strict';

// Prépare des comptes de charge directement en DB afin de ne pas contourner/épuiser le
// rate-limit de l'endpoint public /auth/register. Réservé aux tests locaux/staging.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

// Le serveur charge son .env depuis server/.env. Le script de charge ne doit pas
// dépendre d'une installation npm dans load/ : on lit uniquement les variables
// nécessaires depuis le fichier .env du serveur. Les variables déjà présentes dans
// l'environnement restent prioritaires, comme avec dotenv.
function loadServerEnv() {
  const envPath = path.join(__dirname, '..', 'server', '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    if (process.env[key] !== undefined) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
loadServerEnv();

// Les scripts de charge vivent à la racine, tandis que les dépendances npm sont
// volontairement isolées dans server/. On résout donc les modules depuis le
// package serveur au lieu de dépendre du répertoire courant ou d'un node_modules
// racine inexistant. Cela rend `bash test-scalabilite.sh` reproductible après
// `cd server && npm install`.
const serverRequire = createRequire(path.join(__dirname, '..', 'server', 'package.json'));
let bcrypt;
let jwt;
try {
  bcrypt = serverRequire('bcryptjs');
  jwt = serverRequire('jsonwebtoken');
} catch (err) {
  throw new Error(
    'Dépendances du serveur introuvables. Exécutez `cd server && npm install`, puis relancez le test de scalabilité. ' +
    `Détail: ${err.message}`
  );
}
const { ensureJwtSecret } = require('../server/config/secrets');
ensureJwtSecret();
const { pool, initDatabase } = require('../server/config/db');

const COUNT = Math.max(1, Number.parseInt(process.env.LOAD_USERS || '1000', 10));
const OUT = process.env.LOAD_TOKENS_FILE || path.join(process.cwd(), 'resultats-charge', 'load-test-tokens.json');
const PREFIX = process.env.LOAD_TEST_PREFIX || `charge-load-${Date.now()}`;
const password = process.env.LOAD_TEST_PASSWORD || 'TestCharge2026!';

(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusé en production.');
  await initDatabase();
  const hash = await bcrypt.hash(password, 8);
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET absent.');
  const tokens=[];
  for (let i=1;i<=COUNT;i++) {
    const email=`${PREFIX}-${i}@exemple-test.local`;
    const [existing]=await pool.query('SELECT id FROM users WHERE email=?',[email]);
    let id=existing[0]?.id;
    if (!id) {
      const [r]=await pool.query('INSERT INTO users (nom,email,password_hash,entreprise_nom) VALUES (?,?,?,?)',[`Charge ${i}`,email,hash,`Charge ${i}`]);
      id=r.insertId;
    }
    tokens.push({token:jwt.sign({id,email,role:'administrateur',nom:`Charge ${i}`},secret,{expiresIn:'2h'}),email,password});
    if (i%100===0 || i===COUNT) console.log(`OK ${i}/${COUNT}`);
  }
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(tokens,null,2));
  console.log(`OK ${tokens.length} tokens distincts -> ${OUT}`);
  await pool.end();
})().catch(async e=>{console.error(`❌ ${e.stack||e}`); try{await pool.end();}catch{} process.exit(1);});
