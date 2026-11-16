const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const recipe = fs.readFileSync(path.join(root, 'RECETTE_PREPRODUCTION.md'), 'utf8');
const dockerGuide = fs.readFileSync(path.join(root, 'DOCKER_DEPLOIEMENT.md'), 'utf8');

test('la recette staging crée et distingue les deux fichiers .env', () => {
  assert.match(recipe, /cp \.env\.example \.env/);
  assert.match(recipe, /cp server\/\.env\.example server\/\.env/);
  assert.match(recipe, /--env-file \.env/);
  assert.doesNotMatch(recipe, /--env-file server\/\.env/);
  assert.match(recipe, /server\\\/\\.env/);
});

test('la recette staging utilise le profil HTTPS et un projet Compose isolé', () => {
  assert.match(recipe, /--project-name samafacture-staging/);
  assert.match(recipe, /-f docker-compose\.yml -f docker-compose\.production\.yml/);
  assert.match(recipe, /ports 80\/443/);
  assert.match(recipe, /EXPECT_STAGING_REDIS=true npm run smoke:staging/);
});

test('le guide Docker explique la différence entre interpolation et env_file', () => {
  assert.match(dockerGuide, /--env-file \.env/);
  assert.match(dockerGuide, /env_file: \.\/server\/\.env/);
  assert.match(dockerGuide, /Ne remplacez pas le premier par `server\/\.env`/);
});
