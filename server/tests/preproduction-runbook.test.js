const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const recipe = fs.readFileSync(path.join(root, 'RECETTE_PREPRODUCTION.md'), 'utf8');
const dockerGuide = fs.readFileSync(path.join(root, 'DOCKER_DEPLOIEMENT.md'), 'utf8');

test('la recette staging crée et distingue les deux fichiers .env', () => {
  assert.ok(recipe.includes('cp .env.example .env'));
  assert.ok(recipe.includes('cp server/.env.example server/.env'));
  assert.ok(recipe.includes('--env-file .env'));
  assert.ok(!recipe.includes('--env-file server/.env'));
  assert.ok(recipe.includes('server/.env'));
});

test('la recette staging utilise le profil HTTPS et un projet Compose isolé', () => {
  assert.ok(recipe.includes('--project-name samafacture-staging'));
  assert.ok(recipe.includes('-f docker-compose.yml -f docker-compose.production.yml'));
  assert.ok(recipe.includes('ports 80/443'));
  assert.ok(recipe.includes('EXPECT_STAGING_REDIS=true npm run smoke:staging'));
});

test('le guide Docker explique la différence entre interpolation et env_file', () => {
  assert.ok(dockerGuide.includes('--env-file .env'));
  assert.ok(dockerGuide.includes('env_file: ./server/.env'));
  assert.ok(dockerGuide.includes('Ne remplacez pas le premier par'));
});
