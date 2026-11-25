// Complète la protection de DELETE /api/auth/donnees (PR #218) : un test par historique protégé,
// vérification des DONNÉES après le refus (pas seulement du code HTTP 409), chemin de succès pour
// un compte sans historique, et course concurrente prouvant que les verrous SQL sont effectifs.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

// Tables contrôlées par la route. `overrides` force les colonnes dont la valeur factice par
// défaut ne conviendrait pas à la condition WHERE de la route.
const HISTORIQUES = [
  ['factures', { type: 'facture' }],
  ['paiements'], ['pro_compta_ecritures'], ['pro_compta_lignes'], ['pro_compta_facture_events'],
  ['pro_avoirs'], ['pro_acomptes'], ['pro_refund_requests'], ['pro_payment_links'],
  ['pro_invoice_checkouts'], ['pro_mouvements_stock'], ['pro_stocks_entrepots'], ['pro_commandes'],
  ['pro_bons_livraison'], ['pro_commandes_fournisseurs'], ['pro_commandes_fournisseurs_lignes'],
  ['pro_receptions_achats'], ['pro_receptions_achats_lignes'], ['factures_recurrentes'],
  ['pro_customer_portal_access'], ['pro_portal_quote_decisions'], ['pro_crm_activities'],
  ['pro_documents', 'CLIENT_ID'], ['pro_audit_logs'], ['pro_caisse_operations']
];

let sequence = 0;
function valeurFactice(col) {
  const type = col.type.toLowerCase();
  if (/int|year/.test(type)) return 1;
  if (/decimal|numeric|float|double/.test(type)) return 0;
  if (type === 'enum' || type === 'set') return /'([^']*)'/.exec(col.ctype)[1];
  if (type === 'date') return '2026-01-01';
  if (/datetime|timestamp/.test(type)) return '2026-01-01 00:00:00';
  if (type === 'time') return '00:00:00';
  if (type === 'json') return '{}';
  if (/char/.test(type)) return `t${process.pid}${Date.now() % 1e6}${++sequence}`.slice(0, col.len || 30);
  if (/binary|blob/.test(type)) return Buffer.alloc(Math.min(col.len || 1, 16), 1);
  return 'x';
}

/** Insère une ligne minimale (colonnes NOT NULL sans défaut remplies) pour `userId`. */
async function insererLigne(conn, table, userId, overrides = {}) {
  const [colonnes] = await conn.query(
    `SELECT COLUMN_NAME AS name, DATA_TYPE AS type, COLUMN_TYPE AS ctype, IS_NULLABLE AS nullable,
            COLUMN_DEFAULT AS def, EXTRA AS extra, CHARACTER_MAXIMUM_LENGTH AS len
       FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
    [table]
  );
  assert.ok(colonnes.length > 0, `table ${table} introuvable dans le schéma de test`);
  const valeurs = {};
  for (const col of colonnes) {
    if (/auto_increment|GENERATED/i.test(col.extra || '')) continue;
    if (col.name === 'user_id') valeurs.user_id = userId;
    else if (col.name in overrides) valeurs[col.name] = overrides[col.name];
    else if (col.nullable === 'NO' && col.def === null) valeurs[col.name] = valeurFactice(col);
  }
  const noms = Object.keys(valeurs);
  const [res] = await conn.query(
    `INSERT INTO \`${table}\` (${noms.map((n) => `\`${n}\``).join(',')}) VALUES (${noms.map(() => '?').join(',')})`,
    noms.map((n) => valeurs[n])
  );
  return res.insertId;
}

/** Connexion dédiée sans contrôle de clés étrangères (on teste la garde, pas l'intégrité du jeu d'essai). */
async function avecConnexionSansFk(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    return await fn(conn);
  } finally {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    conn.release();
  }
}

async function compter(table, userId) {
  const [[r]] = await pool.query(`SELECT COUNT(*) AS n FROM \`${table}\` WHERE user_id = ?`, [userId]);
  return Number(r.n);
}

async function inscrire(prefixe) {
  const res = await request(app).post('/api/auth/register')
    .send({ nom: 'Reset Guard', email: emailDeTest(prefixe), password: 'motdepasse123', entreprise_nom: 'Boutique Reset', acceptTerms: true });
  assert.equal(res.status, 201, res.text);
  return { id: res.body.user.id, token: res.body.token };
}

/** Données non protégées que le reset supprimerait : client, produit, dépense, devis. */
async function semerDonneesSimples(userId) {
  return avecConnexionSansFk(async (conn) => {
    const clientId = await insererLigne(conn, 'clients', userId);
    await insererLigne(conn, 'produits', userId);
    await insererLigne(conn, 'depenses', userId);
    await insererLigne(conn, 'factures', userId, { type: 'devis', client_id: clientId });
    return { clientId };
  });
}

async function etatDonneesSimples(userId) {
  const [[devis]] = await pool.query("SELECT COUNT(*) AS n FROM factures WHERE user_id = ? AND type = 'devis'", [userId]);
  return {
    clients: await compter('clients', userId),
    produits: await compter('produits', userId),
    depenses: await compter('depenses', userId),
    devis: Number(devis.n)
  };
}

describe('Réinitialisation du compte — protection de l’historique', () => {
  const comptes = [];
  before(async () => { await setupTestDatabase(); });
  after(async () => { for (const id of comptes) await nettoyerUtilisateur(id); });

  describe('refus par historique protégé (données vérifiées après le refus)', () => {
    let user; let seed;
    before(async () => {
      user = await inscrire('reset-guard'); comptes.push(user.id);
      seed = await semerDonneesSimples(user.id);
    });

    for (const [table, mode] of HISTORIQUES) {
      test(`${table} : 409, historique et données simples intacts`, async () => {
        const overrides = typeof mode === 'object' ? mode : {};
        if (mode === 'CLIENT_ID') overrides.client_id = seed.clientId;
        const avant = await etatDonneesSimples(user.id);
        await avecConnexionSansFk((conn) => insererLigne(conn, table, user.id, overrides));
        try {
          const avantHistorique = await compter(table, user.id);
          const res = await request(app).delete('/api/auth/donnees').set('Authorization', 'Bearer ' + user.token);
          assert.equal(res.status, 409, res.text);
          assert.equal(res.body.code, 'RESET_HISTORIQUE_PROTEGE');
          assert.equal(await compter(table, user.id), avantHistorique, `${table} : la ligne d'historique doit subsister`);
          assert.deepEqual(await etatDonneesSimples(user.id), avant, 'aucune donnée ne doit être supprimée après un refus');
        } finally {
          await pool.query(`DELETE FROM \`${table}\` WHERE user_id = ?${table === 'factures' ? " AND type = 'facture'" : ''}`, [user.id]);
        }
      });
    }
  });

  test('compte sans historique : réinitialisation réussie, entreprise et accès conservés', async () => {
    const user = await inscrire('reset-ok'); comptes.push(user.id);
    await semerDonneesSimples(user.id);
    const avant = await etatDonneesSimples(user.id);
    assert.deepEqual(avant, { clients: 1, produits: 1, depenses: 1, devis: 1 });

    const res = await request(app).delete('/api/auth/donnees').set('Authorization', 'Bearer ' + user.token);
    assert.equal(res.status, 200, res.text);
    assert.deepEqual(await etatDonneesSimples(user.id), { clients: 0, produits: 0, depenses: 0, devis: 0 });

    const [[u]] = await pool.query('SELECT entreprise_nom FROM users WHERE id = ?', [user.id]);
    assert.equal(u.entreprise_nom, 'Boutique Reset', 'les informations d’entreprise doivent être conservées');
    const me = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + user.token);
    assert.equal(me.status, 200, 'le compte reste utilisable après la réinitialisation');
  });

  test('concurrence : une facture créée pendant le reset est détectée (verrous effectifs) et conservée', async () => {
    const user = await inscrire('reset-race'); comptes.push(user.id);
    const { clientId } = await semerDonneesSimples(user.id);

    // Transaction concurrente : crée une facture réelle, non encore validée.
    const concurrente = await pool.getConnection();
    let reset;
    try {
      await concurrente.beginTransaction();
      await insererLigne(concurrente, 'factures', user.id, { type: 'facture', client_id: clientId });

      reset = request(app).delete('/api/auth/donnees').set('Authorization', 'Bearer ' + user.token).then((r) => r);
      // Attend que le reset soit réellement bloqué par un verrou (et non simplement lent).
      let bloque = false;
      for (let i = 0; i < 50 && !bloque; i += 1) {
        try {
          const [[w]] = await pool.query("SELECT COUNT(*) AS n FROM information_schema.INNODB_TRX WHERE trx_state = 'LOCK WAIT'");
          bloque = Number(w.n) > 0;
        } catch { await new Promise((r) => setTimeout(r, 700)); break; }
        if (!bloque) await new Promise((r) => setTimeout(r, 100));
      }
      await concurrente.commit();
    } finally {
      concurrente.release();
    }

    const res = await reset;
    assert.equal(res.status, 409, res.text);
    assert.equal(res.body.code, 'RESET_HISTORIQUE_PROTEGE');
    const [[f]] = await pool.query("SELECT COUNT(*) AS n FROM factures WHERE user_id = ? AND type = 'facture'", [user.id]);
    assert.equal(Number(f.n), 1, 'la facture créée concurremment ne doit jamais être supprimée');
    assert.equal((await etatDonneesSimples(user.id)).clients, 1, 'le client doit subsister');
  });
});

after(teardownTestEnvironment);
