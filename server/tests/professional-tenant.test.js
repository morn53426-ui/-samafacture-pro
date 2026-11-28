const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const crypto = require('node:crypto');
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
let foreignInvoiceVerificationCode;
let foreignPaymentToken;
let ownerInvoiceId;
let foreignRecurringId;
let memberInvoiceId;
let memberInvoicePaymentId;
let foreignClientPaymentId;

before(async () => {
  await setupTestDatabase();

  const ownerRegistration = await request(app)
    .post('/api/auth/register')
    .send({
      nom: 'Entreprise propriétaire',
      email: emailDeTest('tenant-owner'),
      password: 'motdepasse123',
      entreprise_nom: 'Entreprise propriétaire'
    , acceptTerms: true});
  assert.equal(ownerRegistration.status, 201, ownerRegistration.text);
  ownerId = ownerRegistration.body.user.id;
  ownerToken = ownerRegistration.body.token;

  const memberRegistration = await request(app)
    .post('/api/auth/register')
    .send({
      nom: 'Membre lecture seule',
      email: emailDeTest('tenant-member'),
      password: 'motdepasse123'
    , acceptTerms: true});
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

  await pool.query("UPDATE users SET devise = 'EUR', fuseau_horaire = 'Europe/Paris' WHERE id = ?", [ownerId]);

  // Un membre lecture seule peut lire le seul contexte devise/fuseau de l'espace
  // sélectionné, sans gagner l'accès à l'ensemble des paramètres internationaux.
  const companyContext = await request(app)
    .get('/api/pro/company-context')
    .set('Authorization', 'Bearer ' + memberToken)
    .set('X-SF-Company-Owner', String(ownerId));
  assert.equal(companyContext.status, 200, companyContext.text);
  assert.equal(companyContext.body.devise, 'EUR');
  assert.equal(companyContext.body.fuseau_horaire, 'Europe/Paris');

  // Défense en profondeur : une référence inter-entreprises anormale ne doit ni
  // apparaître dans la fiche client de A, ni être supprimée en cascade avec ce client.
  const [invoiceResult] = await pool.query(
    "INSERT INTO factures (user_id, client_id, numero, type, date_emission, statut, remise, frais_livraison, sous_total, total_tva, total, montant_paye) VALUES (?, ?, ?, 'facture', CURDATE(), 'en_attente', 0, 0, 5000, 0, 5000, 0)",
    [memberId, clientId, 'CROSS-TENANT-' + Date.now()]
  );
  foreignInvoiceId = invoiceResult.insertId;
  foreignInvoiceVerificationCode = 'a1b2c3d4e5';
  await pool.query(
    "UPDATE factures SET verification_code = ?, date_echeance = DATE_SUB(CURDATE(), INTERVAL 5 DAY), statut = 'en_retard' WHERE id = ? AND user_id = ?",
    [foreignInvoiceVerificationCode, foreignInvoiceId, memberId]
  );
  const [foreignRecurring] = await pool.query(
    `INSERT INTO factures_recurrentes
      (user_id, client_id, libelle, frequence, prochaine_date, lignes_json)
     VALUES (?, ?, ?, 'mensuelle', CURDATE(), ?)`,
    [memberId, clientId, 'Modèle récurrent mal rattaché', JSON.stringify([
      { designation: 'Prestation test', quantite: 1, prix_unitaire: 100, tva: 0 }
    ])]
  );
  foreignRecurringId = foreignRecurring.insertId;

  const [foreignClientPayment] = await pool.query(
    'INSERT INTO paiements (user_id, facture_id, montant, methode) VALUES (?, ?, ?, ?)',
    [memberId, foreignInvoiceId, 250, 'Espèces']
  );
  foreignClientPaymentId = foreignClientPayment.insertId;

  // Une facture valide de A permet de détecter si son tableau de bord agrège à tort
  // la facture B anormalement rattachée au client A.
  const [ownerInvoice] = await pool.query(
    "INSERT INTO factures (user_id, client_id, numero, type, date_emission, statut, remise, frais_livraison, sous_total, total_tva, total, montant_paye) VALUES (?, ?, ?, 'facture', CURDATE(), 'en_attente', 0, 0, 700, 0, 700, 0)",
    [ownerId, clientId, 'OWNER-TENANT-' + Date.now()]
  );
  ownerInvoiceId = ownerInvoice.insertId;

  // Facture saine de B : une ligne de paiement propre à B et une ligne anormale de A
  // référencent volontairement cette même facture pour vérifier le filtrage par tenant.
  const [memberClient] = await pool.query(
    'INSERT INTO clients (user_id, nom) VALUES (?, ?)',
    [memberId, 'Client entreprise B']
  );
  const [memberInvoice] = await pool.query(
    "INSERT INTO factures (user_id, client_id, numero, type, date_emission, statut, remise, frais_livraison, sous_total, total_tva, total, montant_paye) VALUES (?, ?, ?, 'facture', CURDATE(), 'en_attente', 0, 0, 1000, 0, 1000, 456)",
    [memberId, memberClient.insertId, 'TENANT-DETAIL-' + Date.now()]
  );
  memberInvoiceId = memberInvoice.insertId;
  await pool.query(
    "UPDATE factures SET date_echeance = DATE_SUB(CURDATE(), INTERVAL 3 DAY), statut = 'en_retard' WHERE id = ? AND user_id = ?",
    [memberInvoiceId, memberId]
  );
  const [foreignPayment] = await pool.query(
    'INSERT INTO paiements (user_id, facture_id, montant, methode) VALUES (?, ?, ?, ?)',
    [ownerId, memberInvoiceId, 123, 'Espèces']
  );
  const [memberPayment] = await pool.query(
    'INSERT INTO paiements (user_id, facture_id, montant, methode) VALUES (?, ?, ?, ?)',
    [memberId, memberInvoiceId, 456, 'Espèces']
  );
  memberInvoicePaymentId = memberPayment.insertId;
  assert.ok(foreignPayment.insertId);
});

test('un avoir est refusé pour un devis ou une facture annulée', async () => {
  const fixtures = [
    { type: 'devis', statut: 'en_attente', label: 'DEVIS' },
    { type: 'facture', statut: 'annulee', label: 'FACTURE-ANNULEE' }
  ];

  for (const fixture of fixtures) {
    const [created] = await pool.query(
      `INSERT INTO factures
        (user_id, client_id, numero, type, date_emission, statut, remise, frais_livraison,
         sous_total, total_tva, total, montant_paye)
       VALUES (?, ?, ?, ?, CURDATE(), ?, 0, 0, 1000, 0, 1000, 0)`,
      [
        ownerId,
        clientId,
        'CREDIT-NOTE-' + fixture.label + '-' + Date.now(),
        fixture.type,
        fixture.statut
      ]
    );
    const invoiceId = created.insertId;

    const response = await request(app)
      .post('/api/pro/credit-notes')
      .set('Authorization', 'Bearer ' + ownerToken)
      .send({
        facture_id: invoiceId,
        montant: 250,
        motif: 'Test de refus pour document non éligible'
      });

    assert.equal(response.status, 409, response.text);
    assert.equal(response.body.code, 'AVOIR_FACTURE_INELIGIBLE');

    const [[stored]] = await pool.query(
      'SELECT COUNT(*) AS total FROM pro_avoirs WHERE user_id = ? AND facture_id = ?',
      [ownerId, invoiceId]
    );
    assert.equal(Number(stored.total), 0, 'aucun avoir ne doit être créé pour un document non éligible');
  }
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
  assert.equal(Number(sharedClient.total_facture), 700,
    'le total du client A conserve sa propre facture et exclut la facture B mal rattachée');

  const detail = await request(app)
    .get('/api/clients/' + clientId)
    .set('Authorization', 'Bearer ' + ownerToken);
  assert.equal(detail.status, 200);
  assert.deepEqual(
    detail.body.factures.map(row => Number(row.id)),
    [Number(ownerInvoiceId)],
    'la fiche client doit conserver la facture A sans exposer la facture B mal rattachée'
  );

  // Le membre ne doit pas lire une facture qui référence le client d'une autre entreprise.
  const foreignInvoiceDetail = await request(app)
    .get('/api/factures/' + foreignInvoiceId)
    .set('Authorization', 'Bearer ' + memberToken);
  assert.equal(foreignInvoiceDetail.status, 404,
    'une facture B avec un client A ne doit pas divulguer les coordonnées du client A');

  const foreignInvoiceReminder = await request(app)
    .post('/api/factures/' + foreignInvoiceId + '/relancer')
    .set('Authorization', 'Bearer ' + memberToken);
  assert.equal(foreignInvoiceReminder.status, 404,
    'une relance ne doit jamais utiliser les coordonnées d’un client appartenant à une autre entreprise');

  const [[recurringBefore]] = await pool.query(
    'SELECT prochaine_date, factures_generees FROM factures_recurrentes WHERE id = ? AND user_id = ?',
    [foreignRecurringId, memberId]
  );
  const [[invoiceCountBefore]] = await pool.query(
    'SELECT COUNT(*) AS total FROM factures WHERE user_id = ?',
    [memberId]
  );
  const foreignRecurringGeneration = await request(app)
    .post('/api/factures-recurrentes/' + foreignRecurringId + '/generer')
    .set('Authorization', 'Bearer ' + memberToken);
  assert.equal(foreignRecurringGeneration.status, 409, foreignRecurringGeneration.text);
  assert.equal(foreignRecurringGeneration.body.code, 'CLIENT_TENANT_MISMATCH');
  const [[recurringAfter]] = await pool.query(
    'SELECT prochaine_date, factures_generees FROM factures_recurrentes WHERE id = ? AND user_id = ?',
    [foreignRecurringId, memberId]
  );
  const [[invoiceCountAfter]] = await pool.query(
    'SELECT COUNT(*) AS total FROM factures WHERE user_id = ?',
    [memberId]
  );
  assert.equal(Number(recurringAfter.factures_generees), Number(recurringBefore.factures_generees),
    'le modèle mal rattaché ne doit pas incrémenter son compteur');
  const dateOnly = value => value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
  assert.equal(dateOnly(recurringAfter.prochaine_date), dateOnly(recurringBefore.prochaine_date),
    'le modèle mal rattaché ne doit pas avancer son échéance');
  assert.equal(Number(invoiceCountAfter.total), Number(invoiceCountBefore.total),
    'aucune facture ne doit être générée depuis un modèle lié au client d’une autre entreprise');

  const { envoyerFactureParEmail } = require('../routes/factures');
  await assert.rejects(
    () => envoyerFactureParEmail(foreignInvoiceId, memberId, 'https://example.invalid'),
    /Document introuvable/,
    'l’envoi direct et les envois récurrents doivent refuser une facture mal rattachée'
  );

  const invoiceList = await request(app)
    .get('/api/factures?limite=100')
    .set('Authorization', 'Bearer ' + memberToken);
  assert.equal(invoiceList.status, 200, invoiceList.text);
  assert.equal(invoiceList.body.factures.some(row => Number(row.id) === Number(foreignInvoiceId)), false,
    'la liste B ne doit pas inclure une facture dont le client appartient à A');

  // Un membre lecture seule ne possède pas integrations.manage : la création
  // d'une clé via l'interface doit rester interdite. On insère une clé de fixture
  // pour tester l'isolation API publique sans élargir les permissions du membre.
  const forbiddenApiKeyCreation = await request(app)
    .post('/api/pro/integrations/api-keys')
    .set('Authorization', 'Bearer ' + memberToken)
    .set('X-SF-Company-Owner', String(ownerId))
    .send({ nom: 'Clé API tenant B', scopes: ['invoices:read'] });
  assert.equal(forbiddenApiKeyCreation.status, 403,
    'un membre lecture seule ne doit pas obtenir integrations.manage');

  const apiKeyToken = 'sf_live_' + 'd'.repeat(64);
  const apiKeyHash = crypto.createHash('sha256').update(apiKeyToken).digest('hex');
  await pool.query(
    'INSERT INTO pro_api_keys (user_id, nom, token_hash, scopes_json) VALUES (?, ?, ?, ?)',
    [memberId, 'Clé API fixture tenant B', apiKeyHash, JSON.stringify(['invoices:read'])]
  );
  const publicInvoiceList = await request(app)
    .get('/api/v1/invoices')
    .set('X-SamaFacture-Key', apiKeyToken);
  assert.equal(publicInvoiceList.status, 200, publicInvoiceList.text);
  assert.equal(publicInvoiceList.body.data.some(row => Number(row.id) === Number(foreignInvoiceId)), false,
    'la liste API publique B ne doit pas inclure une facture dont le client appartient à A');
  assert.ok(publicInvoiceList.body.data.some(row => Number(row.id) === Number(memberInvoiceId)),
    'la clé API B doit toujours lire ses propres factures');

  // Les paiements doivent eux aussi être filtrés par tenant, même si une ligne anormale
  // d'une autre entreprise référence l'identifiant de la facture B.
  const memberInvoiceDetail = await request(app)
    .get('/api/factures/' + memberInvoiceId)
    .set('Authorization', 'Bearer ' + memberToken);
  assert.equal(memberInvoiceDetail.status, 200, memberInvoiceDetail.text);
  assert.deepEqual(
    memberInvoiceDetail.body.paiements.map(payment => Number(payment.id)),
    [Number(memberInvoicePaymentId)],
    'le détail B ne doit retourner que les paiements appartenant à B'
  );

  assert.ok(foreignClientPaymentId, 'le paiement mal lié doit bien exister dans la fixture de régression');

  const memberPayments = await request(app)
    .get('/api/pro/payments')
    .set('Authorization', 'Bearer ' + memberToken);
  assert.equal(memberPayments.status, 200, memberPayments.text);
  assert.equal(memberPayments.body.paiements.some(payment => payment.client_nom === 'Client entreprise A'), false,
    'la liste des paiements B ne doit pas divulguer le nom du client A');

  // Vérifier les modules professionnels qui relient eux aussi des factures,
  // commandes et paiements : une FK SQL seule ne garantit pas le même user_id.
  const [foreignOrder] = await pool.query(
    'INSERT INTO pro_commandes (user_id, client_id, numero, statut, date_commande, devise, total, lignes_json) VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?)',
    [ownerId, clientId, 'TENANT-ORDER-' + Date.now(), 'confirmee', 'FCFA', 1000, JSON.stringify([{ designation: 'Commande A', quantite: 1, prix_unitaire: 1000 }])]
  );
  const [foreignDelivery] = await pool.query(
    'INSERT INTO pro_bons_livraison (user_id, commande_id, numero, date_livraison, lignes_json) VALUES (?, ?, ?, CURDATE(), ?)',
    [memberId, foreignOrder.insertId, 'TENANT-BL-' + Date.now(), JSON.stringify([{ designation: 'Livraison A', quantite: 1 }])]
  );
  const [foreignCredit] = await pool.query(
    'INSERT INTO pro_avoirs (user_id, facture_id, numero, date_emission, montant, motif) VALUES (?, ?, ?, CURDATE(), ?, ?)',
    [memberId, ownerInvoiceId, 'TENANT-AV-' + Date.now(), 100, 'Référence inter-entreprises de test']
  );
  const [foreignDeposit] = await pool.query(
    'INSERT INTO pro_acomptes (user_id, facture_id, numero, date_emission, montant) VALUES (?, ?, ?, CURDATE(), ?)',
    [memberId, ownerInvoiceId, 'TENANT-AC-' + Date.now(), 100]
  );
  foreignPaymentToken = 'b'.repeat(64);
  const foreignPaymentTokenHash = crypto.createHash('sha256').update(foreignPaymentToken).digest('hex');
  const [foreignPaymentLink] = await pool.query(
    'INSERT INTO pro_payment_links (user_id, facture_id, token_hash, montant, devise) VALUES (?, ?, ?, ?, ?)',
    [memberId, ownerInvoiceId, foreignPaymentTokenHash, 100, 'FCFA']
  );
  const checkoutReference = 'c'.repeat(64);
  const [foreignCheckout] = await pool.query(
    'INSERT INTO pro_invoice_checkouts (user_id, facture_id, fournisseur, reference_interne, montant, devise, statut) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [memberId, ownerInvoiceId, 'wave', checkoutReference, 100, 'XOF', 'en_attente']
  );

  const deliveryList = await request(app)
    .get('/api/pro/delivery-notes')
    .set('Authorization', 'Bearer ' + memberToken);
  assert.equal(deliveryList.status, 200, deliveryList.text);
  const crossTenantDelivery = deliveryList.body.bons_livraison.find(row => Number(row.id) === Number(foreignDelivery.insertId));
  assert.ok(crossTenantDelivery, 'le bon B peut rester visible dans son historique');
  assert.equal(crossTenantDelivery.client_nom, null,
    'un bon B lié à une commande A ne doit pas révéler le nom du client A');

  const creditList = await request(app)
    .get('/api/pro/credit-notes')
    .set('Authorization', 'Bearer ' + memberToken);
  assert.equal(creditList.status, 200, creditList.text);
  assert.equal(creditList.body.avoirs.some(row => Number(row.id) === Number(foreignCredit.insertId)), false,
    'la liste des avoirs B doit exclure un avoir référant une facture A');

  const depositList = await request(app)
    .get('/api/pro/deposits')
    .set('Authorization', 'Bearer ' + memberToken);
  assert.equal(depositList.status, 200, depositList.text);
  assert.equal(depositList.body.acomptes.some(row => Number(row.id) === Number(foreignDeposit.insertId)), false,
    'la liste des acomptes B doit exclure un acompte référant une facture A');

  const paymentLinkList = await request(app)
    .get('/api/pro/payment-links')
    .set('Authorization', 'Bearer ' + memberToken);
  assert.equal(paymentLinkList.status, 200, paymentLinkList.text);
  assert.equal(paymentLinkList.body.liens.some(row => Number(row.id) === Number(foreignPaymentLink.insertId)), false,
    'la liste des liens de paiement B doit exclure un lien référant une facture A');

  const foreignCheckoutStatus = await request(app)
    .get('/api/pro/checkouts/' + checkoutReference + '/status')
    .set('Authorization', 'Bearer ' + memberToken);
  assert.equal(foreignCheckoutStatus.status, 404,
    'une session de paiement B référant une facture A doit rester introuvable');

  const memberDashboard = await request(app)
    .get('/api/dashboard')
    .set('Authorization', 'Bearer ' + memberToken);
  assert.equal(memberDashboard.status, 200, memberDashboard.text);
  assert.equal(memberDashboard.body.derniers_paiements.some(payment => payment.client_nom === 'Client entreprise A'), false,
    'le tableau de bord B ne doit pas afficher les coordonnées du client A');

  const memberSalesReport = await request(app)
    .get('/api/rapports/ventes?group_by=client')
    .set('Authorization', 'Bearer ' + memberToken);
  assert.equal(memberSalesReport.status, 200, memberSalesReport.text);
  assert.equal(memberSalesReport.body.rows.some(row => row.label === 'Client entreprise A'), false,
    'les rapports de B ne doivent pas exposer le nom du client A');

  const ownerDashboard = await request(app)
    .get('/api/dashboard')
    .set('Authorization', 'Bearer ' + ownerToken);
  assert.equal(ownerDashboard.status, 200, ownerDashboard.text);
  const ownerTopClient = ownerDashboard.body.top_clients.find(row => Number(row.id) === Number(clientId));
  assert.ok(ownerTopClient, 'le client A doit rester présent dans son propre tableau de bord');
  assert.equal(Number(ownerTopClient.nb_factures), 1,
    'le tableau de bord A ne doit pas compter la facture B anormalement liée à son client');

  // Le rôle lecture seule possède clients.read et invoices.read, mais pas clients.write.
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

test('les routes publiques et l’assistant excluent les relations inter-entreprises', async () => {
  const publicInvoice = await request(app)
    .get('/api/public/consulter/' + foreignInvoiceId + '/' + foreignInvoiceVerificationCode);
  assert.equal(publicInvoice.status, 404,
    'la consultation publique ne doit pas révéler le client rattaché à une autre entreprise');

  const publicPaymentLink = await request(app)
    .get('/api/public/paiement/' + foreignPaymentToken);
  assert.equal(publicPaymentLink.status, 404,
    'un lien de paiement B ne doit pas afficher les montants ou références d’une facture A');

  const assistant = require('../routes/assistant');
  const overdue = await assistant.executerOutil('factures_en_retard', {}, memberId);
  assert.deepEqual(overdue.map(row => row.client), ['Client entreprise B'],
    'les factures en retard de B ne doivent pas nommer le client A');
  const topClients = await assistant.executerOutil('top_clients', {}, memberId);
  assert.deepEqual(topClients.map(row => row.client), ['Client entreprise B'],
    'le classement des clients de B ne doit pas inclure le client A');
});

test('le relevé client exclut les remboursements liés à un paiement d’un autre tenant', async () => {
  const [invoiceResult] = await pool.query(
    "INSERT INTO factures (user_id, client_id, numero, type, date_emission, statut, remise, frais_livraison, sous_total, total_tva, total, montant_paye) VALUES (?, ?, ?, 'facture', CURDATE(), 'en_attente', 0, 0, 1000, 0, 1000, 500)",
    [ownerId, clientId, 'REFUND-TENANT-' + Date.now()]
  );
  const invoiceId = invoiceResult.insertId;
  const [paymentResult] = await pool.query(
    'INSERT INTO paiements (user_id, facture_id, montant, methode) VALUES (?, ?, ?, ?)',
    [ownerId, invoiceId, 500, 'Espèces']
  );
  const paymentId = paymentResult.insertId;
  const refundRequest = await request(app)
    .post('/api/pro/payments/' + paymentId + '/refunds')
    .set('Authorization', 'Bearer ' + ownerToken)
    .send({ montant: 100, motif: 'fixture tenant isolation' });
  assert.equal(refundRequest.status, 201, refundRequest.text);
  const refundId = refundRequest.body.id;
  await pool.query(
    "UPDATE pro_refund_requests SET statut = 'rembourse', traite_le = NOW() WHERE id = ? AND user_id = ?",
    [refundId, ownerId]
  );

  // Référence inter-tenant volontairement mal formée : le paiement est B mais
  // l'événement de remboursement et la facture sont A. Le relevé A doit l'exclure.
  await pool.query('UPDATE paiements SET user_id = ? WHERE id = ?', [memberId, paymentId]);
  try {
    const statement = await request(app)
      .get('/api/pro/clients/' + clientId + '/statement')
      .set('Authorization', 'Bearer ' + ownerToken);
    assert.equal(statement.status, 200, statement.text);
    assert.equal(statement.body.remboursements.some(row => Number(row.id) === Number(refundId)), false,
      'un remboursement lié à un paiement d’un autre tenant ne doit pas apparaître dans le relevé A');
  } finally {
    // Restaurer la fixture pour que le teardown supprime les lignes du tenant prévu.
    await pool.query('UPDATE paiements SET user_id = ? WHERE id = ?', [ownerId, paymentId]);
  }
});



after(async () => {
  try {
    // Les lignes professionnelles B insérées dans les tests peuvent référencer des
    // factures/commandes A (FK RESTRICT) : nettoyer B avant le propriétaire A.
    await nettoyerUtilisateur(memberId);
    // Une commande A a été créée dans la fixture puis référencée par un bon B.
    // Après suppression des dépendances B, supprimer explicitement la commande A
    // avant que la cascade du compte A ne tente d'effacer son client.
    if (ownerId) await pool.query('DELETE FROM pro_commandes WHERE user_id = ?', [ownerId]);
    await nettoyerUtilisateur(ownerId);
  } finally {
    await teardownTestEnvironment();
  }
});
