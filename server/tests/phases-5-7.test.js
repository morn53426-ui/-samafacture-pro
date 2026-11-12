const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment
} = require('./setup');

let userA, tokenA, userB, tokenB, clientA, clientB, originalEnv;
const smtpVars = ['SMTP_HOST','SMTP_USER','SMTP_PASSWORD','SMTP_PORT','APP_URL'];

async function register(nom, prefix) {
  const r = await request(app).post('/api/auth/register').send({
    nom, entreprise_nom: nom, email: emailDeTest(prefix), password: 'motdepasse123'
  });
  assert.equal(r.status, 201, r.text);
  return { id: r.body.user.id, token: r.body.token };
}

async function createClient(token, nom, email) {
  const r = await request(app).post('/api/clients').set('Authorization', 'Bearer ' + token)
    .send({ nom, email, telephone: '+221770000000' });
  assert.equal(r.status, 201, r.text);
  return r.body.client.id;
}

async function createDocument(token, clientId, type, devise='FCFA') {
  const r = await request(app).post('/api/factures').set('Authorization', 'Bearer ' + token)
    .send({
      client_id: clientId, type, devise,
      date_emission: '2026-11-12',
      date_validite: type === 'devis' ? '2026-12-15' : undefined,
      lignes: [{ designation: 'Prestation test', quantite: 1, prix_unitaire: 12000, tva: 18 }]
    });
  assert.equal(r.status, 201, r.text);
  return r.body.facture;
}

before(async () => {
  originalEnv = Object.fromEntries(smtpVars.map(k => [k, process.env[k]]));
  for (const key of ['SMTP_HOST','SMTP_USER','SMTP_PASSWORD']) delete process.env[key];
  process.env.APP_URL = 'https://staging.samafacture.invalid';
  await setupTestDatabase();
  const a = await register('Entreprise A phases 5-7', 'phase57a');
  const b = await register('Entreprise B phases 5-7', 'phase57b');
  userA = a.id; tokenA = a.token; userB = b.id; tokenB = b.token;
  clientA = await createClient(tokenA, 'Client Portail A', 'client-a@example.test');
  clientB = await createClient(tokenB, 'Client privé B', 'client-b@example.test');
});

test('portail client : lien à jeton haché, documents limités au client et révocation immédiate', async () => {
  const invoiceA = await createDocument(tokenA, clientA, 'facture', 'XOF');
  const quoteA = await createDocument(tokenA, clientA, 'devis', 'XOF');
  const foreignClient = await createClient(tokenA, 'Autre client A', 'autre-a@example.test');
  await createDocument(tokenA, foreignClient, 'facture', 'XOF');

  const invited = await request(app).post('/api/pro/clients/' + clientA + '/portal')
    .set('Authorization', 'Bearer ' + tokenA).send({});
  assert.equal(invited.status, 201, invited.text);
  assert.equal(invited.body.sent, false, 'Sans SMTP, l’invitation ne doit pas être présentée comme envoyée.');
  assert.match(invited.body.url, /portail-client\.html#token=[a-f0-9]{64}$/);
  const token = new URLSearchParams(new URL(invited.body.url).hash.slice(1)).get('token');
  const [[stored]] = await pool.query(
    'SELECT token_hash, expires_at, revoked_at FROM pro_customer_portal_access WHERE user_id = ? AND client_id = ?',
    [userA, clientA]
  );
  assert.equal(stored.token_hash, require('node:crypto').createHash('sha256').update(token).digest('hex'));
  assert.equal(stored.token_hash.includes(token), false);

  const publicView = await request(app).get('/api/portal/').set('X-SF-Portal-Token', token);
  assert.equal(publicView.status, 200, publicView.text);
  assert.equal(publicView.headers['cache-control'], 'no-store');
  assert.deepEqual(new Set(publicView.body.documents.map(d => Number(d.id))), new Set([Number(invoiceA.id), Number(quoteA.id)]));

  const decision = await request(app).post('/api/portal/quotes/' + quoteA.id + '/decision').set('X-SF-Portal-Token', token)
    .send({ decision: 'accepte', commentaire: 'Bon pour accord.' });
  assert.equal(decision.status, 201, decision.text);
  const replay = await request(app).post('/api/portal/' + token + '/quotes/' + quoteA.id + '/decision')
    .send({ decision: 'refuse' });
  assert.equal(replay.status, 409, replay.text);

  const afterDecision = await request(app).get('/api/portal/' + token);
  assert.equal(afterDecision.status, 200, afterDecision.text);
  assert.equal(afterDecision.body.documents.find(d => Number(d.id) === Number(quoteA.id)).portail_decision, 'accepte');

  const revoked = await request(app).delete('/api/pro/clients/' + clientA + '/portal')
    .set('Authorization', 'Bearer ' + tokenA).send({});
  assert.equal(revoked.status, 200, revoked.text);
  const inaccessible = await request(app).get('/api/portal/' + token);
  assert.equal(inaccessible.status, 404, inaccessible.text);
});

test('CRM : activités, tâches et isolation stricte des clients entre entreprises', async () => {
  const activity = await request(app).post('/api/pro/crm/activities')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({
      client_id: clientA, type: 'tache', titre: 'Rappeler le client',
      description: 'Confirmer le besoin.', due_at: '2026-11-20T10:00:00.000Z'
    });
  assert.equal(activity.status, 201, activity.text);

  const list = await request(app).get('/api/pro/crm/activities?client_id=' + clientA)
    .set('Authorization', 'Bearer ' + tokenA);
  assert.equal(list.status, 200, list.text);
  assert.equal(list.body.activites.length, 1);
  assert.equal(list.body.activites[0].statut, 'a_faire');

  const foreign = await request(app).post('/api/pro/crm/activities')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ client_id: clientB, type: 'note', titre: 'Tentative inter-entreprise' });
  assert.equal(foreign.status, 404, foreign.text);

  const complete = await request(app).put('/api/pro/crm/activities/' + activity.body.id)
    .set('Authorization', 'Bearer ' + tokenA).send({ statut: 'terminee' });
  assert.equal(complete.status, 200, complete.text);
});

test('internationalisation : devises, langue, fuseau et format de date sont validés et conservés par document', async () => {
  const settings = await request(app).put('/api/pro/localization')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({
      pays_code: 'US', langue: 'en', devise: 'USD',
      fuseau_horaire: 'America/New_York', format_date: 'MM/dd/yyyy',
      regime_fiscal: 'standard'
    });
  assert.equal(settings.status, 200, settings.text);
  assert.equal(settings.body.parametres.locale, 'en-US');

  const invalid = await request(app).put('/api/pro/localization')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ pays_code: 'US', langue: 'xx', devise: 'BTC', fuseau_horaire: 'Mars/Phobos' });
  assert.equal(invalid.status, 400, invalid.text);

  const invoice = await createDocument(tokenA, clientA, 'facture', 'USD');
  const [[stored]] = await pool.query('SELECT devise FROM factures WHERE id = ? AND user_id = ?', [invoice.id, userA]);
  assert.equal(stored.devise, 'USD');

  const getSettings = await request(app).get('/api/pro/localization').set('Authorization', 'Bearer ' + tokenA);
  assert.equal(getSettings.status, 200, getSettings.text);
  assert.equal(getSettings.body.parametres.devise, 'USD');
  assert.equal(getSettings.body.parametres.fuseau_horaire, 'America/New_York');

  const secondTenant = await request(app).get('/api/pro/localization').set('Authorization', 'Bearer ' + tokenB);
  assert.equal(secondTenant.status, 200, secondTenant.text);
  assert.notEqual(secondTenant.body.parametres.devise, 'USD', 'les paramètres d’entreprise ne doivent pas fuiter');
});

test('automatisations : créer, lister, désactiver et supprimer les règles autorisées', async () => {
  const rules = [
    { type: 'relance_impayes_email', nom: 'Relance impayés test', configuration: { jours_retard: 10, frequence_jours: 5 } },
    { type: 'relance_devis_email', nom: 'Rappel devis test', configuration: { jours_avant_expiration: 4, frequence_jours: 2 } },
    { type: 'alerte_stock_email', nom: 'Alerte stock test', configuration: { frequence_jours: 1 } }
  ];
  const ids = [];
  for (const rule of rules) {
    const created = await request(app).post('/api/pro/automations')
      .set('Authorization', 'Bearer ' + tokenA).send(rule);
    assert.equal(created.status, 201, created.text);
    ids.push(created.body.id);
  }
  const whatsapp = await request(app).post('/api/pro/automations')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ type: 'relance_impayes_whatsapp', nom: 'WhatsApp test' });
  assert.equal(whatsapp.status, 501, whatsapp.text);

  const listed = await request(app).get('/api/pro/automations').set('Authorization', 'Bearer ' + tokenA);
  assert.equal(listed.status, 200, listed.text);
  assert.ok(listed.body.automatisations.length >= 3);

  const disabled = await request(app).put('/api/pro/automations/' + ids[0])
    .set('Authorization', 'Bearer ' + tokenA).send({ actif: false });
  assert.equal(disabled.status, 200, disabled.text);
  const deleted = await request(app).delete('/api/pro/automations/' + ids[1])
    .set('Authorization', 'Bearer ' + tokenA);
  assert.equal(deleted.status, 200, deleted.text);

  const secondTenant = await request(app).delete('/api/pro/automations/' + ids[2])
    .set('Authorization', 'Bearer ' + tokenB);
  assert.equal(secondTenant.status, 404, secondTenant.text);
});

test('API portail sans jeton ou jeton mal formé : aucun document n’est exposé', async () => {
  const missing = await request(app).get('/api/portal/').set('X-SF-Portal-Token', 'not-a-token');
  assert.equal(missing.status, 404, missing.text);
});

after(async () => {
  try {
    await nettoyerUtilisateur(userA);
    await nettoyerUtilisateur(userB);
  } finally {
    for (const key of smtpVars) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    await teardownTestEnvironment();
  }
});
