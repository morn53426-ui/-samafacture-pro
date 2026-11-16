const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  app,
  pool,
  setupTestDatabase,
  emailDeTest,
  nettoyerUtilisateur,
  teardownTestEnvironment
} = require('./setup');

let groupOwnerId;
let subsidiaryOwnerId;
let outsiderId;
let starterId;
let groupOwnerToken;
let subsidiaryToken;
let outsiderToken;
let starterToken;
let subsidiaryClientId;

async function register(prefix, companyName) {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      nom: companyName,
      email: emailDeTest(prefix),
      password: 'motdepasse123',
      entreprise_nom: companyName,
      acceptTerms: true
    });
  assert.equal(response.status, 201, response.text);
  return response.body;
}

before(async () => {
  await setupTestDatabase();

  const groupOwner = await register('group-owner', 'Groupe Sénégal');
  groupOwnerId = groupOwner.user.id;
  groupOwnerToken = groupOwner.token;
  await pool.query("UPDATE users SET plan = 'entreprise' WHERE id = ?", [groupOwnerId]);

  const subsidiary = await register('group-subsidiary', 'Filiale Dakar');
  subsidiaryOwnerId = subsidiary.user.id;
  subsidiaryToken = subsidiary.token;

  const outsider = await register('group-outsider', 'Société extérieure');
  outsiderId = outsider.user.id;
  outsiderToken = outsider.token;

  const starter = await register('group-starter', 'Compte Starter');
  starterId = starter.user.id;
  starterToken = starter.token;
  await pool.query("UPDATE users SET plan = 'starter' WHERE id = ?", [starterId]);

  const client = await request(app)
    .post('/api/clients')
    .set('Authorization', 'Bearer ' + subsidiaryToken)
    .send({ nom: 'Client filiale Dakar' });
  assert.equal(client.status, 201, client.text);
  subsidiaryClientId = client.body.client.id;
});

test('le plan Entreprise permet de créer un groupe, inviter une société et lui déléguer un accès explicite', async () => {
  const denied = await request(app)
    .post('/api/pro/company-group')
    .set('Authorization', 'Bearer ' + starterToken)
    .send({ nom: 'Groupe non autorisé' });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.code, 'PLAN_ENTREPRISE_REQUIS');

  const created = await request(app)
    .post('/api/pro/company-group')
    .set('Authorization', 'Bearer ' + groupOwnerToken)
    .send({ nom: 'Groupe Sénégal' });
  assert.equal(created.status, 201, created.text);

  const duplicate = await request(app)
    .post('/api/pro/company-group')
    .set('Authorization', 'Bearer ' + groupOwnerToken)
    .send({ nom: 'Deuxième groupe' });
  assert.equal(duplicate.status, 409);

  const invitation = await request(app)
    .post('/api/pro/company-group/invitations')
    .set('Authorization', 'Bearer ' + groupOwnerToken)
    .send({ email: (await pool.query('SELECT email FROM users WHERE id = ?', [subsidiaryOwnerId]))[0][0].email });
  assert.equal(invitation.status, 201, invitation.text);
  assert.equal(invitation.body.email_envoye, false);
  const token = new URL(invitation.body.invitation_url).searchParams.get('token');
  assert.match(token, /^[a-f0-9]{64}$/i);

  const wrongOwner = await request(app)
    .post('/api/pro/company-group/invitations/accept')
    .set('Authorization', 'Bearer ' + outsiderToken)
    .send({ token });
  assert.equal(wrongOwner.status, 403);

  const accepted = await request(app)
    .post('/api/pro/company-group/invitations/accept')
    .set('Authorization', 'Bearer ' + subsidiaryToken)
    .send({ token });
  assert.equal(accepted.status, 200, accepted.text);
  assert.equal(accepted.body.groupe_id, created.body.id);

  const group = await request(app)
    .get('/api/pro/company-group')
    .set('Authorization', 'Bearer ' + groupOwnerToken);
  assert.equal(group.status, 200, group.text);
  assert.equal(group.body.societes.length, 2);
  assert.equal(group.body.societes.filter(company => Number(company.id) === Number(groupOwnerId)).length, 1);
  assert.equal(group.body.societes.filter(company => Number(company.id) === Number(subsidiaryOwnerId)).length, 1);

  const switcher = await request(app)
    .get('/api/pro/team/companies')
    .set('Authorization', 'Bearer ' + groupOwnerToken);
  assert.equal(switcher.status, 200);
  assert.ok(switcher.body.entreprises.some(company => Number(company.id) === Number(subsidiaryOwnerId) && company.source === 'groupe'));

  const subsidiaryData = await request(app)
    .get('/api/clients')
    .set('Authorization', 'Bearer ' + groupOwnerToken)
    .set('X-SF-Company-Owner', String(subsidiaryOwnerId));
  assert.equal(subsidiaryData.status, 200, subsidiaryData.text);
  assert.ok(subsidiaryData.body.clients.some(client => Number(client.id) === Number(subsidiaryClientId)));

  const forbidden = await request(app)
    .get('/api/clients')
    .set('Authorization', 'Bearer ' + outsiderToken)
    .set('X-SF-Company-Owner', String(subsidiaryOwnerId));
  assert.equal(forbidden.status, 403);

  const dashboard = await request(app)
    .get('/api/pro/company-group/dashboard')
    .set('Authorization', 'Bearer ' + groupOwnerToken);
  assert.equal(dashboard.status, 200, dashboard.text);
  assert.equal(dashboard.body.societes.length, 2);
  assert.ok(Array.isArray(dashboard.body.factures_par_devise));
  assert.match(dashboard.body.note, /aucune conversion de change/i);

  const leave = await request(app)
    .delete('/api/pro/company-group/leave')
    .set('Authorization', 'Bearer ' + subsidiaryToken);
  assert.equal(leave.status, 200, leave.text);

  const afterLeave = await request(app)
    .get('/api/clients')
    .set('Authorization', 'Bearer ' + groupOwnerToken)
    .set('X-SF-Company-Owner', String(subsidiaryOwnerId));
  assert.equal(afterLeave.status, 403);

  const groupAfterLeave = await request(app)
    .get('/api/pro/company-group')
    .set('Authorization', 'Bearer ' + groupOwnerToken);
  assert.equal(groupAfterLeave.status, 200);
  assert.equal(groupAfterLeave.body.societes.length, 1);
});

after(async () => {
  try {
    await nettoyerUtilisateur(groupOwnerId);
    await nettoyerUtilisateur(subsidiaryOwnerId);
    await nettoyerUtilisateur(outsiderId);
    await nettoyerUtilisateur(starterId);
  } finally {
    await teardownTestEnvironment();
  }
});
