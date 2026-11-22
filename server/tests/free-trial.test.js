'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const crypto = require('node:crypto');
const {
  TRIAL_DAYS, TRIAL_DURATION_MS, normalizeTrialPlan, isTrialActive
} = require('../utils/free-trial');
const {
  app, pool, setupTestDatabase, emailDeTest, teardownTestEnvironment
} = require('./setup');

const createdUserIds = [];

before(async () => {
  await setupTestDatabase();
});

after(async () => {
  for (const id of createdUserIds) {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
  }
  await teardownTestEnvironment();
});

async function registerTrial(plan, prefix) {
  const email = emailDeTest(prefix || 'trial');
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      nom: 'Compte essai',
      email,
      password: 'motdepasse123',
      entreprise_nom: 'Entreprise essai',
      acceptTerms: true,
      plan
    });
  if (response.body.user?.id) createdUserIds.push(response.body.user.id);
  return response;
}

test('les formules Standard, Pro et Entreprise sont normalisées sans renommer les plans stockés', () => {
  assert.equal(TRIAL_DAYS, 15);
  assert.equal(TRIAL_DURATION_MS, 15 * 24 * 60 * 60 * 1000);
  assert.equal(normalizeTrialPlan('Standard'), 'starter');
  assert.equal(normalizeTrialPlan('starter'), 'starter');
  assert.equal(normalizeTrialPlan('PRO'), 'pro');
  assert.equal(normalizeTrialPlan('entreprise'), 'entreprise');
  assert.equal(normalizeTrialPlan('gratuit'), null);
  assert.equal(normalizeTrialPlan('inconnu'), null);
});

test('la fin d’essai est exclusive et l’évaluation utilise une date UTC explicite', () => {
  const trial = { trial_status: 'trialing', trial_ends_at: '2026-11-22 12:00:00' };
  assert.equal(isTrialActive(trial, '2026-11-22T11:59:59Z'), true);
  assert.equal(isTrialActive(trial, '2026-11-22T12:00:00Z'), false);
  assert.equal(isTrialActive({ ...trial, trial_status: 'expired' }, '2026-11-22T11:00:00Z'), false);
  assert.equal(isTrialActive({ ...trial, trial_ends_at: null }, '2026-11-22T11:00:00Z'), false);
});

test('une inscription avec chaque formule démarre un seul essai de exactement 15 jours', async () => {
  for (const [selected, canonical] of [
    ['standard', 'starter'],
    ['pro', 'pro'],
    ['entreprise', 'entreprise']
  ]) {
    const response = await registerTrial(selected, 'trial-' + canonical);
    assert.equal(response.status, 201, response.text);
    assert.equal(response.body.user.plan, canonical);
    assert.equal(response.body.user.trial_plan, canonical);
    assert.equal(response.body.user.trial_status, 'trialing');
    assert.ok(response.body.user.trial_started_at);
    assert.ok(response.body.user.trial_ends_at);

    const [[timing]] = await pool.query(
      'SELECT TIMESTAMPDIFF(SECOND, trial_started_at, trial_ends_at) AS seconds FROM users WHERE id = ?',
      [response.body.user.id]
    );
    assert.equal(Number(timing.seconds), 15 * 24 * 60 * 60);
  }
});

test('changer de formule pendant l’essai ne remet jamais le compteur à zéro', async () => {
  const response = await registerTrial('standard', 'trial-switch');
  assert.equal(response.status, 201, response.text);
  const userId = response.body.user.id;
  const token = response.body.token;
  const [[beforeChange]] = await pool.query(
    'SELECT trial_started_at, trial_ends_at FROM users WHERE id = ?',
    [userId]
  );

  const changed = await request(app)
    .put('/api/auth/plan')
    .set('Authorization', 'Bearer ' + token)
    .send({ plan: 'pro' });

  assert.equal(changed.status, 200, changed.text);
  assert.equal(changed.body.user.plan, 'pro');
  assert.equal(changed.body.user.trial_plan, 'pro');
  assert.equal(changed.body.user.trial_status, 'trialing');

  const [[afterChange]] = await pool.query(
    'SELECT trial_started_at, trial_ends_at FROM users WHERE id = ?',
    [userId]
  );
  assert.equal(afterChange.trial_started_at, beforeChange.trial_started_at);
  assert.equal(afterChange.trial_ends_at, beforeChange.trial_ends_at);
});

test('l’expiration ramène au Gratuit avant les routes protégées sans supprimer les données', async () => {
  const response = await registerTrial('entreprise', 'trial-expire');
  assert.equal(response.status, 201, response.text);
  const userId = response.body.user.id;
  const token = response.body.token;

  const client = await request(app)
    .post('/api/clients')
    .set('Authorization', 'Bearer ' + token)
    .send({ nom: 'Client conservé après essai' });
  assert.equal(client.status, 201, client.text);

  await pool.query(
    'UPDATE users SET trial_ends_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 SECOND) WHERE id = ?',
    [userId]
  );

  // La première requête protégée après expiration tente directement de réactiver
  // un plan payant : elle ne doit pas dépendre d'un passage préalable par /auth/me.
  const directAttempt = await request(app)
    .put('/api/auth/plan')
    .set('Authorization', 'Bearer ' + token)
    .send({ plan: 'pro' });
  assert.equal(directAttempt.status, 403, directAttempt.text);
  assert.equal(directAttempt.body.code, 'PAIEMENT_REQUIS');

  const [[expiredAccount]] = await pool.query(
    'SELECT plan, trial_status FROM users WHERE id = ?',
    [userId]
  );
  assert.equal(expiredAccount.plan, 'gratuit');
  assert.equal(expiredAccount.trial_status, 'expired');

  const me = await request(app)
    .get('/api/auth/me')
    .set('Authorization', 'Bearer ' + token);
  assert.equal(me.status, 200, me.text);
  assert.equal(me.body.user.plan, 'gratuit');
  assert.equal(me.body.user.trial_status, 'expired');

  const [[remaining]] = await pool.query(
    'SELECT COUNT(*) AS total FROM clients WHERE user_id = ?',
    [userId]
  );
  assert.equal(Number(remaining.total), 1);
});

test('un nouveau compte créé avec une invitation d’équipe ne reçoit pas un essai individuel concurrent', async () => {
  const inviterEmail = emailDeTest('trial-inviter');
  const invitedEmail = emailDeTest('trial-invited');
  const [inviter] = await pool.query(
    'INSERT INTO users (nom, email, password_hash, entreprise_nom) VALUES (?, ?, ?, ?)',
    ['Entreprise invitante', inviterEmail, 'hash-test-inutilisable', 'Entreprise invitante']
  );
  createdUserIds.push(inviter.insertId);

  await pool.query(
    `INSERT INTO pro_team_invitations
      (user_id, email, role, permissions_json, token_hash, expire_at)
     VALUES (?, ?, 'employe', ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 DAY))`,
    [inviter.insertId, invitedEmail, JSON.stringify(['dashboard.read']), crypto.randomBytes(32).toString('hex')]
  );

  const response = await request(app)
    .post('/api/auth/register')
    .send({
      nom: 'Membre invité',
      email: invitedEmail,
      password: 'motdepasse123',
      acceptTerms: true,
      plan: 'entreprise'
    });
  if (response.body.user?.id) createdUserIds.push(response.body.user.id);

  assert.equal(response.status, 201, response.text);
  assert.equal(response.body.user.plan, 'gratuit');
  assert.equal(response.body.user.trial_status, 'not_started');
  assert.equal(response.body.user.trial_started_at, null);
  assert.equal(response.body.user.trial_ends_at, null);
});
