'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { linkGoogleIdentity, findGoogleUserAfterInsertConflict } = require('../utils/google-account');

describe('Concurrence de liaison des comptes Google', () => {
  test('une identité Google déjà liée est réutilisée sans réinitialiser le mot de passe', async () => {
    const user = { id: 7, google_id: 'google-7', password_hash: 'hash-existant' };
    const calls = [];
    const pool = { query: async (...args) => { calls.push(args); return [[], []]; } };
    const linked = await linkGoogleIdentity(pool, user, 'google-7', async () => {
      throw new Error('le hash ne doit pas être recalculé');
    });
    assert.equal(linked, user);
    assert.equal(calls.length, 0);
  });

  test('lie un compte sans google_id en une mise à jour atomique et révoque ses sessions', async () => {
    const user = { id: 8, google_id: null };
    const calls = [];
    const linkedRow = { id: 8, google_id: 'google-8', token_version: 3 };
    const pool = {
      query: async (sql, params) => {
        calls.push({ sql, params });
        if (sql.startsWith('UPDATE users')) return [{ affectedRows: 1 }, []];
        if (sql === 'SELECT * FROM users WHERE id = ?') return [[linkedRow], []];
        throw new Error('Requête inattendue : ' + sql);
      }
    };
    let hashCalls = 0;
    const linked = await linkGoogleIdentity(pool, user, 'google-8', async () => {
      hashCalls += 1;
      return 'hash-aleatoire';
    });
    assert.equal(linked, linkedRow);
    assert.equal(hashCalls, 1);
    assert.match(calls[0].sql, /token_version = token_version \\+ 1/);
    assert.match(calls[0].sql, /google_id IS NULL OR google_id = ''/);
    assert.deepEqual(calls[0].params, ['google-8', 'hash-aleatoire', 8]);
    assert.equal(calls.length, 2);
  });

  test('ne remplace pas une identité Google différente liée entre-temps', async () => {
    const user = { id: 9, google_id: null };
    const calls = [];
    const linkedByAnotherRequest = { id: 9, google_id: 'google-other' };
    const pool = {
      query: async (sql) => {
        calls.push(sql);
        if (sql.startsWith('UPDATE users')) return [{ affectedRows: 0 }, []];
        return [[linkedByAnotherRequest], []];
      }
    };
    const linked = await linkGoogleIdentity(pool, user, 'google-request', async () => 'hash');
    assert.equal(linked, null);
    assert.equal(calls.length, 2);
  });

  test('refuse une collision unique de google_id au lieu de remplacer un autre compte', async () => {
    const user = { id: 10, google_id: null };
    const pool = {
      query: async (sql) => {
        if (sql.startsWith('UPDATE users')) {
          const error = new Error('duplicate google_id');
          error.code = 'ER_DUP_ENTRY';
          throw error;
        }
        throw new Error('aucune relecture attendue');
      }
    };
    const linked = await linkGoogleIdentity(pool, user, 'google-owned-elsewhere', async () => 'hash');
    assert.equal(linked, null);
  });

  test('après une insertion concurrente, privilégie le même Google ID avant l’email', async () => {
    const calls = [];
    const googleUser = { id: 11, google_id: 'google-11', email: 'same@example.test' };
    const pool = {
      query: async (sql, params) => {
        calls.push({ sql, params });
        if (sql.includes('WHERE google_id = ?')) return [[googleUser], []];
        throw new Error('la recherche par email ne doit pas être nécessaire');
      }
    };
    const result = await findGoogleUserAfterInsertConflict(pool, 'google-11', 'same@example.test');
    assert.deepEqual(result, { source: 'google', user: googleUser });
    assert.equal(calls.length, 1);
  });

  test('après une insertion concurrente email, retourne le compte existant à l’étape de liaison', async () => {
    const calls = [];
    const emailUser = { id: 12, google_id: null, email: 'same@example.test' };
    const pool = {
      query: async (sql, params) => {
        calls.push({ sql, params });
        if (sql.includes('WHERE google_id = ?')) return [[], []];
        if (sql.includes('WHERE email = ?')) return [[emailUser], []];
        throw new Error('Requête inattendue : ' + sql);
      }
    };
    const result = await findGoogleUserAfterInsertConflict(pool, 'google-12', 'same@example.test');
    assert.deepEqual(result, { source: 'email', user: emailUser });
    assert.equal(calls.length, 2);
  });

  test('signale une collision non retrouvée sans masquer l’erreur appelante', async () => {
    const pool = { query: async () => [[], []] };
    const result = await findGoogleUserAfterInsertConflict(pool, 'google-13', 'missing@example.test');
    assert.deepEqual(result, { source: 'missing', user: null });
  });
});