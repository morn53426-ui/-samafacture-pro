'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const seedPath = path.join(__dirname, '..', 'scripts', 'seed-video-demo.js');
const seed = fs.readFileSync(seedPath, 'utf8');

test('the video demo seeder has a strict dedicated-database guard', () => {
  assert.match(seed, /const DB = ['"]samafacture_demo['"]/);
  assert.match(seed, /process\.env\.DB_NAME\s*!==\s*DB/);
  assert.match(seed, /process\.env\.DEMO_SEED_CONFIRM\s*!==\s*CONFIRM/);
  assert.match(seed, /const CONFIRM = ['"]SUNUPILOT_DEMO_ONLY['"]/);
});

test('the demo seeder never deletes, truncates or updates existing rows', () => {
  assert.doesNotMatch(seed, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(seed, /\bTRUNCATE\s+TABLE\b/i);
  assert.doesNotMatch(seed, /\bDROP\s+(?:DATABASE|TABLE)\b/i);
  assert.doesNotMatch(seed, /\bUPDATE\s+[a-z_][a-z0-9_]*\s+SET\b/i);
  assert.match(seed, /SELECT id FROM users WHERE email = \? LIMIT 1/);
  assert.match(seed, /if \(existing\.length\) throw new Error/);
});

test('the demonstration account uses a random password stored only as a bcrypt hash', () => {
  assert.match(seed, /crypto\.randomBytes\(24\)\.toString\(['"]base64url['"]\)/);
  assert.match(seed, /bcrypt\.hash\(password, 12\)/);
  assert.doesNotMatch(seed, /password\s*[:=]\s*['"][^'"]{8,}['"]/i);
});

test('the demo data is explicitly fictional', () => {
  assert.match(seed, /demo\.video@sunupilot\.test/);
  assert.match(seed, /DÉMO/);
  assert.match(seed, /DEMO-FAC-/);
  assert.match(seed, /DEMO-DEV-/);
  assert.match(seed, /Donnée fictive/);
});

test('the demo seeder is valid JavaScript syntax', () => {
  const result = spawnSync(process.execPath, ['--check', seedPath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'node --check failed');
});
