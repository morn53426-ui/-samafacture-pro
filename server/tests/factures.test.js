const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

describe('Factures : calcul et numérotation', () => {
  let userId;
  let token;
  let clientId;

  before(async () => {
    await setupTestDatabase();

    const email = emailDeTest('factures');
    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Factures', email, password: 'motdepasse123' , acceptTerms: true});
    userId = inscription.body.user.id;
    token = inscription.body.token;
    // Ce scénario crée plus de 10 factures au total : utiliser Pro évite le quota
    // Gratuit de 10 factures/mois et teste bien la logique de calcul/numérotation.
    await require('../config/db').pool.query("UPDATE users SET plan = 'pro' WHERE id = ?", [userId]);

    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client de Test' });
    clientId = client.body.client.id;

    // Les tests de protection comptable utilisent des lignes de facture libres.
    // Cette fixture attribue explicitement le compte de services ; aucune valeur
    // par défaut n'est devinée par l'API de production.
    const accounting = await request(app)
      .get('/api/pro/accounting/config')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(accounting.status, 200, accounting.text);
    const freeTextMapping = await request(app)
      .put('/api/pro/accounting/mappings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type_source: 'vente',
        cle_source: 'saisie_libre',
        compte_id: accounting.body.comptes.find(account => account.code === '706').id
      });
    assert.equal(freeTextMapping.status, 200, freeTextMapping.text);
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  test('le calcul de la TVA est correct sur une facture simple (sans remise)', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'facture',
        lignes: [{ designation: 'Article A', quantite: 10, prix_unitaire: 1000, tva: 18 }]
      });

    assert.equal(res.status, 201);
    const { facture } = res.body;
    assert.equal(facture.sous_total, 10000);
    assert.equal(facture.total_tva, 1800); // 10000 * 18%
    assert.equal(facture.total, 11800);
  });

  test('la remise réduit la base imposable avant calcul de la TVA (remise + livraison)', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'facture',
        remise: 1000,
        frais_livraison: 500,
        lignes: [{ designation: 'Article B', quantite: 10, prix_unitaire: 1000, tva: 18 }]
      });

    assert.equal(res.status, 201);
    const { facture } = res.body;
    assert.equal(facture.sous_total, 10000);
    // TVA calculée sur (10000 - 1000) = 9000, pas sur les 10000 bruts
    assert.equal(facture.total_tva, 1620);
    assert.equal(facture.total, 11120); // 10000 - 1000 + 1620 + 500
  });

  test('une remise supérieure au sous-total est plafonnée (pas de base imposable négative)', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'facture',
        remise: 99999,
        lignes: [{ designation: 'Article C', quantite: 1, prix_unitaire: 1000, tva: 0 }]
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.facture.total, 0); // remise plafonnée à 1000, donc 1000 - 1000 = 0
  });

  test("une quantité ou un prix négatif envoyé directement à l'API est refusé", async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'facture',
        lignes: [{ designation: 'Article négatif', quantite: -5, prix_unitaire: -1000, tva: 18 }]
      });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /Quantité|Prix unitaire/);
  });

  test('le calcul financier arrondit chaque montant au centime sans dérive flottante', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'facture',
        lignes: [{ designation: 'Article décimal', quantite: 3, prix_unitaire: 0.10, tva: 18 }]
      });

    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.facture.sous_total, 0.30);
    assert.equal(res.body.facture.total_tva, 0.05);
    assert.equal(res.body.facture.total, 0.35);
  });

  test('la remise répartie entre petites lignes ne crée pas de remise négative et la TVA reste cohérente', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'facture',
        remise: 0.02,
        lignes: [
          { designation: 'Petite ligne 1', quantite: 1, prix_unitaire: 0.10, tva: 0 },
          { designation: 'Petite ligne 2', quantite: 1, prix_unitaire: 0.10, tva: 0 },
          { designation: 'Petite ligne 3', quantite: 1, prix_unitaire: 0.10, tva: 0 },
          { designation: 'Ligne imposable', quantite: 1, prix_unitaire: 0.10, tva: 100 }
        ]
      });

    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.facture.sous_total, 0.40);
    assert.equal(res.body.facture.remise, 0.02);
    assert.equal(res.body.facture.total_tva, 0.10);
    assert.equal(res.body.facture.total, 0.48);
  });

  test('une quantité avec plus de deux décimales est refusée au lieu d’être tronquée par MySQL', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'facture',
        lignes: [{ designation: 'Quantité trop précise', quantite: '1.234', prix_unitaire: 1000, tva: 18 }]
      });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /Quantité.*décimale/);
  });

  test('un prix avec plus de deux décimales est refusé et ne crée pas de facture', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'facture',
        lignes: [{ designation: 'Prix invalide', quantite: 1, prix_unitaire: '100.001', tva: 18 }]
      });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /décimale/);
  });

  test('une facture sans client est refusée', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'facture', lignes: [{ designation: 'X', quantite: 1, prix_unitaire: 100, tva: 0 }] });
    assert.equal(res.status, 400);
  });

  test('une facture sans aucune ligne est refusée', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [] });
    assert.equal(res.status, 400);
  });

  test('un devis conserve son objet, sa référence, sa validité et ses conditions', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'devis',
        date_validite: '2026-12-15',
        objet: 'Installation réseau',
        reference_externe: 'BC-CLIENT-014',
        conditions_reglement: 'Acompte de 40 % à la commande.',
        lignes: [{ designation: 'Installation', quantite: 1, prix_unitaire: 100000, tva: 18 }]
      });

    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.facture.objet, 'Installation réseau');
    assert.equal(res.body.facture.reference_externe, 'BC-CLIENT-014');
    assert.equal(String(res.body.facture.date_validite).slice(0, 10), '2026-12-15');
    assert.equal(res.body.facture.conditions_reglement, 'Acompte de 40 % à la commande.');

    const detail = await request(app)
      .get(`/api/factures/${res.body.facture.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.facture.objet, 'Installation réseau');
    assert.equal(detail.body.facture.reference_externe, 'BC-CLIENT-014');
  });

  test('la conversion d’un devis en facture conserve ses références et supprime la validité du devis', async () => {
    const quote = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'devis',
        date_validite: '2026-12-20',
        objet: 'Déploiement réseau',
        reference_externe: 'BC-CONVERSION-02',
        conditions_reglement: 'Paiement à 15 jours.',
        lignes: [{ designation: 'Installation', quantite: 1, prix_unitaire: 50000, tva: 18 }]
      });
    assert.equal(quote.status, 201, quote.text);

    const converted = await request(app)
      .post(`/api/factures/${quote.body.facture.id}/transformer-en-facture`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(converted.status, 200, converted.text);
    assert.equal(converted.body.facture.type, 'facture');
    assert.equal(converted.body.facture.date_validite, null);
    assert.equal(converted.body.facture.objet, 'Déploiement réseau');
    assert.equal(converted.body.facture.reference_externe, 'BC-CONVERSION-02');
    assert.equal(converted.body.facture.conditions_reglement, 'Paiement à 15 jours.');
  });

  test('la duplication d’un devis copie toutes les références et conditions', async () => {
    const quote = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'devis',
        date_validite: '2026-12-22',
        objet: 'Maintenance annuelle',
        reference_externe: 'BC-DUP-03',
        conditions_reglement: 'Offre valable après validation écrite.',
        lignes: [{ designation: 'Maintenance', quantite: 1, prix_unitaire: 25000, tva: 18 }]
      });
    assert.equal(quote.status, 201, quote.text);
    // Simule un document historique dont la devise diffère de la devise société.
    await pool.query('UPDATE factures SET devise = ? WHERE id = ?', ['EUR', quote.body.facture.id]);

    const duplicate = await request(app)
      .post(`/api/factures/${quote.body.facture.id}/dupliquer`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(duplicate.status, 201, duplicate.text);
    assert.equal(duplicate.body.facture.type, 'devis');
    assert.equal(duplicate.body.facture.date_validite, '2026-12-22');
    assert.equal(duplicate.body.facture.devise, 'EUR');
    assert.equal(duplicate.body.facture.objet, 'Maintenance annuelle');
    assert.equal(duplicate.body.facture.reference_externe, 'BC-DUP-03');
    assert.equal(duplicate.body.facture.conditions_reglement, 'Offre valable après validation écrite.');
  });

  test('la duplication d’une facture conserve sa date d’échéance et sa devise', async () => {
    const source = await request(app).post('/api/factures').set('Authorization', `Bearer ${token}`).send({
      client_id: clientId, type: 'facture', date_echeance: '2026-12-29', devise: 'FCFA',
      lignes: [{ designation: 'Facture à dupliquer', quantite: 1, prix_unitaire: 12000, tva: 18 }]
    });
    assert.equal(source.status, 201, source.text);
    await pool.query('UPDATE factures SET devise = ? WHERE id = ?', ['EUR', source.body.facture.id]);
    const duplicate = await request(app).post(`/api/factures/${source.body.facture.id}/dupliquer`).set('Authorization', `Bearer ${token}`);
    assert.equal(duplicate.status, 201, duplicate.text);
    assert.equal(duplicate.body.facture.date_echeance, '2026-12-29');
    assert.equal(duplicate.body.facture.devise, 'EUR');
  });
  test('une date de validité invalide est refusée pour un devis', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'devis',
        date_validite: '15/12/2026',
        lignes: [{ designation: 'Article', quantite: 1, prix_unitaire: 1000, tva: 0 }]
      });
    assert.equal(res.status, 400);
  });

  test('un objet ou des conditions trop longs sont limités côté serveur', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'devis',
        objet: 'O'.repeat(250),
        reference_externe: 'R'.repeat(150),
        conditions_reglement: 'C'.repeat(6000),
        lignes: [{ designation: 'Article', quantite: 1, prix_unitaire: 1000, tva: 0 }]
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.facture.objet.length, 190);
    assert.equal(res.body.facture.reference_externe.length, 100);
    assert.equal(res.body.facture.conditions_reglement.length, 5000);
  });


  test('les numéros de facture sont attribués de façon séquentielle', async () => {
    const creer = () => request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Séquence', quantite: 1, prix_unitaire: 100, tva: 0 }] });

    const premiere = await creer();
    const deuxieme = await creer();

    const numeroPremiere = parseInt(premiere.body.facture.numero.split('-').pop(), 10);
    const numeroDeuxieme = parseInt(deuxieme.body.facture.numero.split('-').pop(), 10);
    assert.equal(numeroDeuxieme, numeroPremiere + 1);
  });

  test('créer plusieurs factures en même temps ne produit jamais de numéro en double (test de la correction anti-doublon)', async () => {
    const creer = () => request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Concurrence', quantite: 1, prix_unitaire: 100, tva: 0 }] });

    // Envoie 10 créations de facture strictement en parallèle : avant la correction basée sur
    // COUNT(*), plusieurs requêtes simultanées pouvaient recevoir le même numéro.
    const resultats = await Promise.all(Array.from({ length: 10 }, creer));

    resultats.forEach(r => assert.equal(r.status, 201));
    const numeros = resultats.map(r => r.body.facture.numero);
    const numerosUniques = new Set(numeros);
    assert.equal(numerosUniques.size, numeros.length, `numéros en double détectés : ${numeros.join(', ')}`);
  });

  test('un paiement négatif ou nul est refusé', async () => {
    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Paiement', quantite: 1, prix_unitaire: 1000, tva: 0 }] });

    const paiementNegatif = await request(app)
      .post(`/api/factures/${facture.body.facture.id}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ montant: -100, methode: 'Espèces' });
    assert.equal(paiementNegatif.status, 400);

    const paiementValide = await request(app)
      .post(`/api/factures/${facture.body.facture.id}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ montant: 1000, methode: 'Espèces' });
    assert.equal(paiementValide.status, 201);
    assert.equal(paiementValide.body.facture.statut, 'payee');
  });

  test('plusieurs paiements partiels simultanés sur la même facture ne se perdent jamais (correction de la race condition sur le solde)', async () => {
    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Paiements concurrents', quantite: 1, prix_unitaire: 10000, tva: 0 }] });

    const payer = (montant) => request(app)
      .post(`/api/factures/${facture.body.facture.id}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ montant, methode: 'Espèces' });

    // 5 paiements de 2000 envoyés strictement en parallèle = 10000 au total, montant exact
    // de la facture. Avant la correction (SELECT ... FOR UPDATE), le SELECT initial hors
    // transaction pouvait faire perdre des paiements simultanés dans montant_paye.
    const resultats = await Promise.all(Array.from({ length: 5 }, () => payer(2000)));
    resultats.forEach(r => assert.equal(r.status, 201));

    const detail = await request(app)
      .get(`/api/factures/${facture.body.facture.id}`)
      .set('Authorization', `Bearer ${token}`);

    assert.equal(Number(detail.body.facture.montant_paye), 10000, 'les 5 paiements simultanés doivent tous être comptabilisés');
    assert.equal(detail.body.paiements.length, 5);
    assert.equal(detail.body.facture.statut, 'payee');
  });

  test('une facture avec paiement ne peut pas être supprimée et conserve son règlement', async () => {
    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Historique paiement', quantite: 1, prix_unitaire: 1000, tva: 0 }] });
    assert.equal(facture.status, 201, facture.text);

    const paiement = await request(app)
      .post(`/api/factures/${facture.body.facture.id}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ montant: 400, methode: 'Espèces' });
    assert.equal(paiement.status, 201, paiement.text);

    const suppression = await request(app)
      .delete(`/api/factures/${facture.body.facture.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(suppression.status, 409, suppression.text);
    assert.equal(suppression.body.code, 'DOCUMENT_HISTORIQUE_PROTEGE');

    const [[document]] = await pool.query('SELECT id, montant_paye FROM factures WHERE id = ? AND user_id = ?', [facture.body.facture.id, userId]);
    const [[paiements]] = await pool.query('SELECT COUNT(*) AS n FROM paiements WHERE user_id = ? AND facture_id = ?', [userId, facture.body.facture.id]);
    assert.ok(document, 'la facture doit rester présente');
    assert.equal(Number(document.montant_paye), 400);
    assert.equal(Number(paiements.n), 1, 'le règlement doit rester présent');
  });

  test('une facture comptabilisée ne peut pas être supprimée et conserve son écriture', async () => {
    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Historique comptable', quantite: 1, prix_unitaire: 2000, tva: 0 }] });
    assert.equal(facture.status, 201, facture.text);

    const comptabilisation = await request(app)
      .post(`/api/pro/accounting/post-invoice/${facture.body.facture.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(comptabilisation.status, 201, comptabilisation.text);

    const suppression = await request(app)
      .delete(`/api/factures/${facture.body.facture.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(suppression.status, 409, suppression.text);
    assert.equal(suppression.body.code, 'DOCUMENT_HISTORIQUE_PROTEGE');

    const [[document]] = await pool.query('SELECT id FROM factures WHERE id = ? AND user_id = ?', [facture.body.facture.id, userId]);
    const [[entries]] = await pool.query(
      "SELECT COUNT(*) AS n FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'facture' AND source_id = ?",
      [userId, facture.body.facture.id]
    );
    assert.ok(document, 'la facture comptabilisée doit rester présente');
    assert.equal(Number(entries.n), 1, 'l’écriture comptable doit rester présente');
  });

  test('une facture avec article de stock ne peut pas être supprimée (mouvement non lié au document)', async () => {
    const product = await request(app)
      .post('/api/produits')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Article stock suppression protégée', type_catalogue: 'produit', prix_ht: 1000, prix_achat: 500, tva: 0, stock: 10 });
    assert.equal(product.status, 201, product.text);

    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        type: 'facture',
        lignes: [{ produit_id: product.body.produit.id, designation: product.body.produit.nom, quantite: 1, prix_unitaire: 1000, tva: 0 }]
      });
    assert.equal(facture.status, 201, facture.text);

    const suppression = await request(app)
      .delete(`/api/factures/${facture.body.facture.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(suppression.status, 409, suppression.text);
    assert.equal(suppression.body.code, 'DOCUMENT_HISTORIQUE_PROTEGE');

    const [[storedInvoice]] = await pool.query('SELECT id FROM factures WHERE id = ? AND user_id = ?', [facture.body.facture.id, userId]);
    const [[storedProduct]] = await pool.query('SELECT stock FROM produits WHERE id = ? AND user_id = ?', [product.body.produit.id, userId]);
    assert.ok(storedInvoice, 'la facture doit rester présente');
    assert.equal(Number(storedProduct.stock), 9, 'le stock décompté doit rester cohérent tant que la facture n’est pas annulée');
  });

  test('suppression et comptabilisation concurrentes ne créent pas d’écriture orpheline', async () => {
    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Race suppression/compta', quantite: 1, prix_unitaire: 3000, tva: 0 }] });
    assert.equal(facture.status, 201, facture.text);

    const invoiceId = facture.body.facture.id;
    const [suppression, comptabilisation] = await Promise.all([
      request(app).delete(`/api/factures/${invoiceId}`).set('Authorization', `Bearer ${token}`),
      request(app).post(`/api/pro/accounting/post-invoice/${invoiceId}`).set('Authorization', `Bearer ${token}`)
    ]);

    assert.equal(suppression.status, 409, suppression.text);
    assert.equal(suppression.body.code, 'DOCUMENT_HISTORIQUE_PROTEGE');
    assert.equal(comptabilisation.status, 201, comptabilisation.text);
    const [[stored]] = await pool.query('SELECT id FROM factures WHERE id = ? AND user_id = ?', [invoiceId, userId]);
    const [[entries]] = await pool.query(
      "SELECT COUNT(*) AS n FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'facture' AND source_id = ?",
      [userId, invoiceId]
    );
    assert.ok(stored, 'la facture finale doit rester présente');
    assert.equal(Number(entries.n), 1, 'la comptabilisation doit rester reliée à la facture conservée');
  });

  test('une facture de service émise sans historique ne peut pas être supprimée', async () => {
    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Service sans mouvement de stock', quantite: 1, prix_unitaire: 5000, tva: 0 }] });
    assert.equal(facture.status, 201, facture.text);

    const suppression = await request(app)
      .delete(`/api/factures/${facture.body.facture.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(suppression.status, 409, suppression.text);
    assert.equal(suppression.body.code, 'DOCUMENT_HISTORIQUE_PROTEGE');
    const [[stored]] = await pool.query('SELECT id FROM factures WHERE id = ? AND user_id = ?', [facture.body.facture.id, userId]);
    assert.ok(stored, 'toute facture émise doit rester dans l’historique');
  });

  test('un devis sans historique reste supprimable', async () => {
    const devis = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'devis', lignes: [{ designation: 'Devis à supprimer', quantite: 1, prix_unitaire: 5000, tva: 0 }] });
    assert.equal(devis.status, 201, devis.text);

    const suppression = await request(app)
      .delete(`/api/factures/${devis.body.facture.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(suppression.status, 200, suppression.text);
    const [[stored]] = await pool.query('SELECT id FROM factures WHERE id = ? AND user_id = ?', [devis.body.facture.id, userId]);
    assert.equal(stored, undefined);
  });
});

describe('Factures : idempotence des créations', () => {
  let userId;
  let token;
  let clientId;

  before(async () => {
    await setupTestDatabase();
    const email = emailDeTest('factures-idem');
    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Idempotence', email, password: 'motdepasse123' , acceptTerms: true});
    userId = inscription.body.user.id;
    token = inscription.body.token;
    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client Idempotence' });
    clientId = client.body.client.id;
  });

  after(async () => { await nettoyerUtilisateur(userId); });

  test('une même Idempotency-Key ne crée pas deux devis', async () => {
    const key = `idem-${Date.now()}-devis`;
    const payload = {
      client_id: clientId,
      type: 'devis',
      lignes: [{ designation: 'Article idempotent', quantite: 1, prix_unitaire: 1000, tva: 0 }]
    };
    const [a, b] = await Promise.all([
      request(app).post('/api/factures').set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key).send(payload),
      request(app).post('/api/factures').set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key).send(payload)
    ]);
    assert.ok([200, 201].includes(a.status));
    assert.ok([200, 201].includes(b.status));
    assert.equal(a.body.facture.id, b.body.facture.id);
    const [[{ n }]] = await require('../config/db').pool.query(
      'SELECT COUNT(*) AS n FROM factures WHERE user_id = ? AND idempotency_key = ?', [userId, key]
    );
    assert.equal(Number(n), 1);
  });

  test('une Idempotency-Key trop courte est refusée', async () => {
    const res = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'short')
      .send({ client_id: clientId, type: 'devis', lignes: [{ designation: 'X', quantite: 1, prix_unitaire: 100, tva: 0 }] });
    assert.equal(res.status, 400);
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
