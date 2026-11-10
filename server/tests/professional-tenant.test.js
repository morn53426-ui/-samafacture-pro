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

let ownerId;
let memberId;
let ownerToken;
let memberToken;
let clientId;
let foreignInvoiceId;

before(async () => {
  await setupTestDatabase();

  const ownerRegistration = await request(app)
    .post('/api/auth/register')
    .send({
      nom: 'Entreprise propriétaire',
      email: emailDeTest('tenant-owner'),
      password: 'motdepasse123',
      entreprise_nom: 'Entreprise propriétaire'
    });
  assert.equal(ownerRegistration.status, 201, ownerRegistration.text);
  ownerId = ownerRegistration.body.user.id;
  ownerToken = ownerRegistration.body.token;

  const memberRegistration = await request(app)
    .post('/api/auth/register')
    .send({
      nom: 'Membre lecture seule',
      email: emailDeTest('tenant-member'),
      password: 'motdepasse123'
    });
  assert.equal(memberRegistration.status, 201, memberRegistration.text);
  memberId = memberRegistration.body.user.id;
  memberToken = memberRegistration.body.token;

  const clientResponse = await request(app)
    .post('/api/clients')
    .set('Authorization', 'Bearer ' + ownerToken)
    .send({ nom: 'Client entreprise A' });
  assert.equal(clientResponse.status, 201, clientResponse.text);
  clientId = clientResponse.body.client.id;

  // Simule une invitation acceptée avec un rôle strictement en lecture seule.
  await pool.query(
    'INSERT INTO pro_team_members (owner_user_id, member_user_id, role, permissions_json, active) VALUES (?, ?, ?, ?, 1)',
    [ownerId, memberId, 'lecture_seule', JSON.stringify(['clients.read'])]
  );

  // Défense en profondeur : une référence inter-entreprises anormale ne doit ni
  // apparaître dans la fiche client de A, ni être supprimée en cascade avec ce client.
  const [invoiceResult] = await pool.query(
    "INSERT INTO factures (user_id, client_id, numero, type, date_emission, statut, remise, frais_livraison, sous_total, total_tva, total, montant_paye) VALUES (?, ?, ?, 'facture', CURDATE(), 'en_attente', 0, 0, 5000, 0, 5000, 0)",
    [memberId, clientId, 'CROSS-TENANT-' + Date.now()]
  );
  foreignInvoiceId = invoiceResult.insertId;
});

test('les espaces entreprise isolent les clients, les factures et les permissions', async () => {
  // Un membre voit les données de son compte personnel uniquement sans sélection d'espace.
  const personalList = await request(app)
    .get('/api/clients')
    .set('Authorization', 'Bearer ' + memberToken);
  assert.equal(personalList.status, 200);
  assert.equal(personalList.body.clients.some(client => Number(client.id) === Number(clientId)), false);

  // Une sélection d'entreprise sans adhésion active est refusée.
  const forgedCompany = await request(app)
    .get('/api/clients')
    .set('Authorization', 'Bearer ' + memberToken)
    .set('X-SF-Company-Owner', String(Number(ownerId) + 999999));
  assert.equal(forgedCompany.status, 403);

  // Avec l'adhésion active, le membre voit les clients de l'entreprise et aucun autre compte.
  const companyList = await request(app)
    .get('/api/clients')
    .set('Authorization', 'Bearer ' + memberToken)
    .set('X-SF-Company-Owner', String(ownerId));
  assert.equal(companyList.status, 200);
  const sharedClient = companyList.body.clients.find(client => Number(client.id) === Number(clientId));
  assert.ok(sharedClient, 'le client de l’entreprise doit être visible par le membre autorisé');

  // Une facture rattachée anormalement au client mais appartenant au membre ne doit pas
  // polluer les totaux affichés dans l’espace de l’entreprise propriétaire.
  assert.equal(Number(sharedClient.total_facture), 0);

  const detail = await request(app)
    .get('/api/clients/' + clientId)
    .set('Authorization', 'Bearer ' + ownerToken);
  assert.equal(detail.status, 200);
  assert.deepEqual(detail.body.factures, [], 'la fiche client ne doit pas exposer les factures d’un autre compte');

  // Le rôle lecture seule possède clients.read mais pas clients.write.
  const forbiddenWrite = await request(app)
    .post('/api/clients')
    .set('Authorization', 'Bearer ' + memberToken)
    .set('X-SF-Company-Owner', String(ownerId))
    .send({ nom: 'Création interdite' });
  assert.equal(forbiddenWrite.status, 403);

  // La suppression du client ne doit pas effacer silencieusement la facture de l'autre compte.
  const forbiddenDelete = await request(app)
    .delete('/api/clients/' + clientId)
    .set('Authorization', 'Bearer ' + ownerToken);
  assert.equal(forbiddenDelete.status, 409);
  const [[remainingInvoice]] = await pool.query(
    'SELECT id FROM factures WHERE id = ? AND user_id = ?',
    [foreignInvoiceId, memberId]
  );
  assert.ok(remainingInvoice, 'la facture de l’autre compte doit être conservée');
});

after(async () => {
  try {
    await nettoyerUtilisateur(ownerId);
    await nettoyerUtilisateur(memberId);
  } finally {
    await teardownTestEnvironment();
  }
});
