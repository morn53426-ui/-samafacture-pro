const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Remplace la base par un double contrôlable pour vérifier que chaque worker
// relit la version courante au lieu de réutiliser une ancienne valeur en mémoire.
const dbPath = require.resolve('../config/db');
const sessionPath = require.resolve('../utils/session');
const state = {
  version: 0,
  exists: true,
  selectCount: 0,
  updateCount: 0
};

const pool = {
  async query(sql, params) {
    if (sql.includes('SELECT token_version')) {
      state.selectCount += 1;
      assert.deepEqual(params, [1]);
      return [state.exists ? [{ token_version: state.version }] : []];
    }
    if (sql.includes('UPDATE users SET token_version = token_version + 1')) {
      state.updateCount += 1;
      state.version += 1;
      return [{ affectedRows: 1 }];
    }
    throw new Error('Requête inattendue dans le double de base : ' + sql);
  }
};

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: { pool }
};
delete require.cache[sessionPath];

const {
  getTokenVersion,
  jetonEstValide,
  incrementerTokenVersion
} = require('../utils/session');

describe('Révocation immédiate des sessions entre workers', () => {
  beforeEach(() => {
    state.version = 0;
    state.exists = true;
    state.selectCount = 0;
    state.updateCount = 0;
  });

  test('getTokenVersion relit la base à chaque appel et ne réutilise pas une valeur locale', async () => {
    assert.equal(await getTokenVersion(1), 0);
    state.version = 3;
    assert.equal(await getTokenVersion(1), 3);
    assert.equal(state.selectCount, 2);
  });

  test('un ancien jeton est refusé dès que la version change dans la base', async () => {
    const ancienJeton = { id: 1, tv: 0 };
    assert.equal(await jetonEstValide(ancienJeton), true);

    // Simule une révocation effectuée par un autre worker / une autre instance.
    state.version = 1;

    assert.equal(await jetonEstValide(ancienJeton), false);
    assert.equal(state.selectCount, 2);
  });

  test('un nouveau jeton reste valide après la révocation', async () => {
    state.version = 7;
    assert.equal(await jetonEstValide({ id: 1, tv: 7 }), true);
    assert.equal(await jetonEstValide({ id: 1, tv: 6 }), false);
  });

  test('un compte supprimé et un identifiant invalide ne sont jamais authentifiés', async () => {
    state.exists = false;
    assert.equal(await jetonEstValide({ id: 1, tv: 0 }), false);
    assert.equal(await getTokenVersion('not-an-id'), null);
    assert.equal(state.selectCount, 1);
  });

  test('incrementerTokenVersion utilise la connexion transactionnelle fournie', async () => {
    let connectionUpdateCount = 0;
    const connection = {
      async query(sql, params) {
        assert.ok(sql.includes('UPDATE users SET token_version = token_version + 1'));
        assert.deepEqual(params, [1]);
        connectionUpdateCount += 1;
        state.version += 1;
        return [{ affectedRows: 1 }];
      }
    };

    await incrementerTokenVersion(connection, 1);

    assert.equal(connectionUpdateCount, 1);
    assert.equal(state.updateCount, 0);
    assert.equal(state.version, 1);
    assert.equal(await jetonEstValide({ id: 1, tv: 0 }), false);
  });
});
