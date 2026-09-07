const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

// Vérifie que la génération automatique d'une facture récurrente calcule exactement les
// mêmes totaux qu'une facture créée manuellement avec les mêmes lignes et la même remise —
// c'était un bug réel avant la phase 5 (TVA calculée sur le HT brut, sans tenir compte de
// la remise, dans le générateur de factures récurrentes).
describe('Factures récurrentes : cohérence des calculs avec la création manuelle', () => {
  let userId, token, clientId;

  before(async () => {
    await setupTestDatabase();
    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Récurrentes', email: emailDeTest('recur'), password: 'motdepasse123' });
    userId = inscription.body.user.id;
    token = inscription.body.token;

    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client Récurrent' });
    clientId = client.body.client.id;
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  test('une facture générée depuis un modèle récurrent avec remise applique la TVA sur la base nette (comme une facture manuelle)', async () => {
    const lignes = [{ designation: 'Abonnement mensuel', quantite: 1, prix_unitaire: 10000, tva: 18 }];

    // Référence : la même facture créée manuellement, pour comparaison directe.
    const manuelle = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', remise: 2000, lignes });

    const modele = await request(app)
      .post('/api/factures-recurrentes')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, libelle: 'Abonnement', frequence: 'mensuelle', remise: 2000, lignes });
    assert.equal(modele.status, 201);

    const generee = await request(app)
      .post(`/api/factures-recurrentes/${modele.body.recurrente.id}/generer`)
      .set('Authorization', `Bearer ${token}`);

    assert.equal(generee.status, 201);
    // TVA sur (10000 - 2000) * 18% = 1440, et non 1800 (bug corrigé : avant la phase 5,
    // le générateur aurait calculé la TVA sur les 10000 bruts).
    assert.equal(Number(generee.body.facture.total_tva), 1440);
    assert.equal(Number(generee.body.facture.total_tva), Number(manuelle.body.facture.total_tva),
      'la facture générée automatiquement doit calculer exactement la même TVA que la facture manuelle équivalente');
    assert.equal(Number(generee.body.facture.total), Number(manuelle.body.facture.total));
  });

  test('générer une facture récurrente inexistante renvoie 404', async () => {
    const res = await request(app)
      .post('/api/factures-recurrentes/999999999/generer')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 404);
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
