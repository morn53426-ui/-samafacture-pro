const { SUPPORTED_COUNTRIES, SUPPORTED_CURRENCIES, SUPPORTED_TIMEZONES } = require('../../config/localization');
const crypto = require('crypto');
const { isSmtpConfigured, sendMail } = require('../../config/mailer');
const { pool } = require('../../config/db');
const {
  ACCOUNTING_SALE_MAPPING_KEYS,
  actor,
  audit,
  buildInvoiceAccountingLines,
  ensureAccountingDefaults,
  htmlEscape,
  idOk,
  normalizeAccountingCategoryKey,
  optionalIsoDate,
  optionalText,
  owner,
  paymentTreasuryAccount,
  postSystemEntry,
  randomRef,
  requireExpenseCorrespondence
} = require('./shared');

module.exports = function registerAccountingCrmRoutes(router) {
router.get('/accounting/config', async (req, res, next) => {
  try {
    await ensureAccountingDefaults(owner(req));
    const [accountsResult, journalsResult] = await Promise.all([
      pool.query('SELECT id, code, libelle, classe, nature, lettrable, actif FROM pro_compta_comptes WHERE user_id = ? ORDER BY code', [owner(req)]),
      pool.query('SELECT id, code, libelle, type, actif FROM pro_compta_journaux WHERE user_id = ? ORDER BY code', [owner(req)])
    ]);
    res.json({ comptes: accountsResult[0], journaux: journalsResult[0], standard: 'SYSCOHADA — plan de démarrage à valider avec un expert-comptable local' });
  } catch (err) { next(err); }
});


router.get('/accounting/mappings', async (req, res, next) => {
  try {
    const uid = owner(req);
    await ensureAccountingDefaults(uid);
    const [mappingRows, categoryRows] = await Promise.all([
      pool.query(
        'SELECT m.type_source, m.cle_source, m.compte_id, c.code, c.libelle, c.classe, c.actif FROM pro_compta_correspondances m JOIN pro_compta_comptes c ON c.id = m.compte_id AND c.user_id = m.user_id WHERE m.user_id = ? ORDER BY m.type_source, m.cle_source',
        [uid]
      ),
      pool.query(
        "SELECT DISTINCT TRIM(categorie) AS categorie FROM depenses WHERE user_id = ? AND categorie IS NOT NULL AND TRIM(categorie) <> '' ORDER BY categorie",
        [uid]
      )
    ]);
    const mappings = mappingRows[0];
    const fallback = mappings.find(row => row.type_source === 'depense' && row.cle_source === '__default__');
    const categories = categoryRows[0].map(row => {
      const key = normalizeAccountingCategoryKey(row.categorie);
      const specific = mappings.find(mapping => mapping.type_source === 'depense' && mapping.cle_source === key);
      const effective = specific || fallback || null;
      return {
        categorie: row.categorie,
        cle_source: key,
        personnalisee: Boolean(specific),
        compte_id: effective?.compte_id ?? null,
        code: effective?.code ?? null,
        libelle: effective?.libelle ?? null
      };
    });
    res.json({ correspondances: mappings, categories_depenses: categories });
  } catch (err) { next(err); }
});

router.put('/accounting/mappings', async (req, res, next) => {
  try {
    const uid = owner(req);
    const sourceType = String(req.body.type_source || '').trim().toLowerCase();
    const rawKey = String(req.body.cle_source ?? '');
    let sourceKey;
    if (sourceType === 'vente') {
      sourceKey = rawKey.trim().toLowerCase();
      if (!ACCOUNTING_SALE_MAPPING_KEYS.includes(sourceKey)) {
        return res.status(400).json({ error: 'Type de vente invalide.', code: 'TYPE_CORRESPONDANCE_INVALIDE' });
      }
    } else if (sourceType === 'depense') {
      const normalizedCategory = String(rawKey).normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
      if (rawKey === '__default__') {
        sourceKey = '__default__';
      } else if (!normalizedCategory || normalizedCategory.length > 100) {
        return res.status(400).json({ error: 'Indiquez une catégorie de dépense valide (100 caractères maximum).', code: 'CATEGORIE_CORRESPONDANCE_INVALIDE' });
      } else {
        sourceKey = normalizedCategory;
      }
    } else {
      return res.status(400).json({ error: 'La source doit être vente ou dépense.', code: 'SOURCE_CORRESPONDANCE_INVALIDE' });
    }

    const accountIdValue = Number(req.body.compte_id);
    if (!idOk(accountIdValue)) return res.status(400).json({ error: 'Compte comptable invalide.' });
    const expectedClass = sourceType === 'vente' ? 7 : 6;
    const [accountRows] = await pool.query(
      'SELECT id, code, libelle, classe FROM pro_compta_comptes WHERE id = ? AND user_id = ? AND actif = 1 LIMIT 1',
      [accountIdValue, uid]
    );
    const account = accountRows[0];
    if (!account) return res.status(404).json({ error: 'Compte actif introuvable dans cette entreprise.' });
    if (Number(account.classe) !== expectedClass) {
      return res.status(400).json({
        error: 'Une vente doit être affectée à un compte de classe 7 et une dépense à un compte de classe 6.',
        code: 'CLASSE_COMPTE_CORRESPONDANCE_INVALIDE'
      });
    }

    await pool.query(
      'INSERT INTO pro_compta_correspondances (user_id, type_source, cle_source, compte_id) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE compte_id = VALUES(compte_id)',
      [uid, sourceType, sourceKey, accountIdValue]
    );
    await audit(req, 'comptabilite.correspondance_modifiee', 'compte', accountIdValue, {
      type_source: sourceType,
      cle_source: sourceKey,
      code_compte: account.code
    });
    res.json({ success: true, correspondance: { type_source: sourceType, cle_source: sourceKey, compte_id: account.id, code: account.code, libelle: account.libelle } });
  } catch (err) { next(err); }
});

router.post('/accounting/accounts', async (req, res, next) => {
  try {
    const code = String(req.body.code || '').trim().slice(0,20), libelle = String(req.body.libelle || '').trim().slice(0,190);
    const classe = Number(req.body.classe), nature = String(req.body.nature || 'debit');
    if (!/^\d{1,8}$/.test(code) || !libelle || !Number.isInteger(classe) || classe < 1 || classe > 8 || !['debit','credit'].includes(nature)) return res.status(400).json({ error: 'Code, libellé, classe 1 à 8 et nature débit/crédit requis.' });
    const [result] = await pool.query('INSERT INTO pro_compta_comptes (user_id, code, libelle, classe, nature, lettrable) VALUES (?, ?, ?, ?, ?, ?)', [owner(req), code, libelle, classe, nature, req.body.lettrable ? 1 : 0]);
    res.status(201).json({ id: result.insertId, code, libelle });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ce numéro de compte existe déjà.' });
    next(err);
  }
});

router.post('/accounting/entries', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req), lines = Array.isArray(req.body.lignes) ? req.body.lignes : [];
    const label = String(req.body.libelle || '').trim().slice(0,255);
    const date = optionalIsoDate(req.body.date_ecriture);
    if (!idOk(req.body.journal_id) || !label || date === undefined || !date || lines.length < 2 || lines.length > 100) return res.status(400).json({ error: 'Journal, date, libellé et au moins deux lignes sont obligatoires.' });
    let debit = 0, credit = 0;
    const clean = [];
    for (const line of lines) {
      const account = Number(line.compte_id);
      const d = Math.round(Number(line.debit || 0) * 100) / 100;
      const c = Math.round(Number(line.credit || 0) * 100) / 100;
      if (!idOk(account) || !Number.isFinite(d) || !Number.isFinite(c) || d < 0 || c < 0 || (d > 0 && c > 0) || (d === 0 && c === 0)) return res.status(400).json({ error: 'Chaque ligne doit avoir un compte et un seul montant débit ou crédit positif (au centime).' });
      debit += d; credit += c;
      clean.push({ account, d, c, label: String(line.libelle || label).slice(0,255), tiers: optionalText(line.tiers,190) });
    }
    debit = Math.round(debit * 100) / 100; credit = Math.round(credit * 100) / 100;
    if (Math.abs(debit - credit) > 0.01) return res.status(400).json({ error: 'Écriture déséquilibrée : total débit et crédit doivent être identiques.' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    // Les écritures manuelles sont elles aussi un historique qui fige la devise.
    const [[account]] = await conn.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [uid]);
    if (!account) { await conn.rollback(); return res.status(404).json({ error: 'Entreprise introuvable.' }); }
    const [journalRows] = await conn.query('SELECT id FROM pro_compta_journaux WHERE id = ? AND user_id = ? AND actif = 1', [req.body.journal_id, uid]);
    if (!journalRows.length) { await conn.rollback(); return res.status(400).json({ error: 'Journal invalide.' }); }
    const ids = [...new Set(clean.map(line => line.account))];
    const [accounts] = await conn.query(`SELECT id FROM pro_compta_comptes WHERE user_id = ? AND actif = 1 AND id IN (${ids.map(() => '?').join(',')})`, [uid, ...ids]);
    if (accounts.length !== ids.length) { await conn.rollback(); return res.status(400).json({ error: 'Un compte comptable ne appartient pas à cette entreprise ou est inactif.' }); }
    const numero = randomRef('ECR');
    const [entry] = await conn.query(
      "INSERT INTO pro_compta_ecritures (user_id, journal_id, numero, date_ecriture, reference, libelle, statut, total_debit, total_credit, acteur_user_id, validee_le) VALUES (?, ?, ?, ?, ?, ?, 'validee', ?, ?, ?, NOW())",
      [uid, req.body.journal_id, numero, date, optionalText(req.body.reference,120), label, debit, credit, actor(req)]
    );
    for (const line of clean) {
      await conn.query('INSERT INTO pro_compta_lignes (user_id, ecriture_id, compte_id, libelle, debit, credit, tiers) VALUES (?, ?, ?, ?, ?, ?, ?)', [uid, entry.insertId, line.account, line.label, line.d, line.c, line.tiers]);
    }
    await conn.commit();
    await audit(req, 'comptabilite.ecriture_validee', 'ecriture', entry.insertId, { numero, debit, credit });
    res.status(201).json({ id: entry.insertId, numero, statut: 'validee', total_debit: debit, total_credit: credit });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally { if (conn) conn.release(); }
});

router.get('/accounting/entries', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT e.id, e.numero, e.date_ecriture, e.reference, e.libelle, e.total_debit, e.total_credit, j.code AS journal_code, j.libelle AS journal_libelle FROM pro_compta_ecritures e JOIN pro_compta_journaux j ON j.id = e.journal_id AND j.user_id = e.user_id WHERE e.user_id = ? AND e.statut = \'validee\' ORDER BY e.date_ecriture DESC, e.id DESC LIMIT 200',
      [owner(req)]
    );
    res.json({ ecritures: rows });
  } catch (err) { next(err); }
});

router.get('/accounting/trial-balance', async (req, res, next) => {
  try {
    await ensureAccountingDefaults(owner(req));
    const from = optionalIsoDate(req.query.from), to = optionalIsoDate(req.query.to);
    if (from === undefined || to === undefined) return res.status(400).json({ error: 'Période invalide.' });
    let filters = ' AND e.statut = ?'; const params = [owner(req), 'validee'];
    if (from) { filters += ' AND e.date_ecriture >= ?'; params.push(from); }
    if (to) { filters += ' AND e.date_ecriture <= ?'; params.push(to); }
    const [rows] = await pool.query(
      `SELECT c.id, c.code, c.libelle, c.classe,
        COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.debit ELSE 0 END),0) AS total_debit,
        COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.credit ELSE 0 END),0) AS total_credit,
        COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.debit-l.credit ELSE 0 END),0) AS solde
       FROM pro_compta_comptes c
       LEFT JOIN pro_compta_lignes l ON l.compte_id = c.id AND l.user_id = c.user_id
       LEFT JOIN pro_compta_ecritures e ON e.id = l.ecriture_id AND e.user_id = c.user_id ${filters}
       WHERE c.user_id = ? GROUP BY c.id ORDER BY c.code`,
      [...params.slice(1), owner(req)]
    );
    const totalDebit = rows.reduce((sum,row)=>sum+Number(row.total_debit),0);
    const totalCredit = rows.reduce((sum,row)=>sum+Number(row.total_credit),0);
    res.json({ balance: rows, total_debit: totalDebit, total_credit: totalCredit, equilibree: Math.abs(totalDebit-totalCredit) <= 0.01, periode: { from: from || null, to: to || null } });
  } catch (err) { next(err); }
});

router.get('/accounting/ledger', async (req, res, next) => {
  try {
    const accountIdValue = Number(req.query.compte_id);
    if (!idOk(accountIdValue)) return res.status(400).json({ error: 'compte_id obligatoire.' });
    const [accountRows] = await pool.query('SELECT id, code, libelle FROM pro_compta_comptes WHERE id = ? AND user_id = ?', [accountIdValue, owner(req)]);
    if (!accountRows.length) return res.status(404).json({ error: 'Compte introuvable.' });
    const from = optionalIsoDate(req.query.from), to = optionalIsoDate(req.query.to);
    if (from === undefined || to === undefined) return res.status(400).json({ error: 'Période invalide.' });
    const filters = [], params = [owner(req), accountIdValue];
    if (from) { filters.push('e.date_ecriture >= ?'); params.push(from); }
    if (to) { filters.push('e.date_ecriture <= ?'); params.push(to); }
    const [rows] = await pool.query(
      `SELECT e.date_ecriture, e.numero, e.reference, e.libelle AS ecriture_libelle, l.libelle, l.debit, l.credit, l.tiers FROM pro_compta_lignes l JOIN pro_compta_ecritures e ON e.id = l.ecriture_id AND e.user_id = l.user_id WHERE l.user_id = ? AND l.compte_id = ? AND e.statut = 'validee' ${filters.length ? 'AND '+filters.join(' AND ') : ''} ORDER BY e.date_ecriture, e.id, l.id`,
      params
    );
    let running = 0;
    const entries = rows.map(row => { running += Number(row.debit) - Number(row.credit); return { ...row, solde_progressif: Math.round(running*100)/100 }; });
    res.json({ compte: accountRows[0], ecritures: entries, solde_periode: Math.round(running*100)/100 });
  } catch (err) { next(err); }
});

router.post('/accounting/post-invoice/:id', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req);
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [rows] = await conn.query(
      "SELECT * FROM factures WHERE id = ? AND user_id = ? AND type = 'facture' AND statut <> 'annulee' FOR UPDATE",
      [req.params.id, uid]
    );
    const invoice = rows[0];
    if (!invoice) {
      await conn.rollback();
      return res.status(404).json({ error: 'Facture non trouvée ou annulée.' });
    }

    // Une écriture validée doit rester idempotente même si une correspondance a
    // été modifiée ou si son compte est ensuite désactivé. Ne pas recalculer la pièce.
    const [existingEntries] = await conn.query(
      "SELECT id, numero FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'facture' AND source_id = ? LIMIT 1 FOR UPDATE",
      [uid, invoice.id]
    );
    if (existingEntries.length) {
      await conn.commit();
      return res.status(200).json({
        id: existingEntries[0].id,
        numero: existingEntries[0].numero,
        duplicate: true
      });
    }

    await ensureAccountingDefaults(uid, conn);
    const lines = await buildInvoiceAccountingLines(uid, invoice, conn);
    const result = await postSystemEntry(
      uid,
      actor(req),
      'facture',
      invoice.id,
      invoice.date_emission,
      'Comptabilisation facture ' + invoice.numero,
      'VE',
      lines,
      conn
    );
    await conn.commit();
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    if (err.code === 'FACTURE_NON_COMPTABILISABLE') return res.status(409).json({ error: 'La facture a été supprimée ou annulée avant sa comptabilisation.' });
    if (err.status === 409 && err.code) return res.status(409).json({ error: err.message, code: err.code });
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.post('/accounting/post-payment/:id', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req);
    // Le même verrou paiement est utilisé par le traitement des remboursements :
    // les deux opérations ne peuvent pas créer des écritures concurrentes divergentes.
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT * FROM paiements WHERE id = ? AND user_id = ? FOR UPDATE',
      [req.params.id, uid]
    );
    const payment = rows[0];
    if (!payment) {
      await conn.rollback();
      return res.status(404).json({ error: 'Paiement introuvable.' });
    }
    // Lire le numéro de facture sans verrouiller celle-ci : le traitement du
    // remboursement suit le même ordre de verrous (paiement, puis facture).
    const [invoiceRows] = await conn.query(
      'SELECT numero FROM factures WHERE id = ? AND user_id = ? LIMIT 1',
      [payment.facture_id, uid]
    );
    if (!invoiceRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Facture du paiement introuvable.' });
    }
    const invoiceNumber = invoiceRows[0].numero;
    const treasuryAccount = paymentTreasuryAccount(payment.methode);
    if (!treasuryAccount) {
      await conn.rollback();
      return res.status(409).json({
        error: 'La méthode de paiement ne permet pas de déterminer le compte de trésorerie.',
        code: 'METHODE_PAIEMENT_NON_RECONNUE'
      });
    }
    const bank = treasuryAccount === '521';
    const result = await postSystemEntry(
      uid,
      actor(req),
      'paiement',
      payment.id,
      String(payment.date_paiement).slice(0, 10),
      'Encaissement facture ' + invoiceNumber,
      bank ? 'BQ' : 'CA',
      [
        { code: bank ? '521' : '571', libelle: 'Règlement ' + invoiceNumber, debit: Number(payment.montant), credit: 0, paiement_id: payment.id },
        { code: '411', libelle: 'Lettrage client ' + invoiceNumber, debit: 0, credit: Number(payment.montant), paiement_id: payment.id }
      ],
      conn
    );
    await conn.commit();
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.post('/accounting/post-expense/:id', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req);
    conn = await pool.getConnection();
    await conn.beginTransaction();
    // Le verrou commun avec PUT/DELETE empêche une modification concurrente
    // entre la lecture du mode de règlement et la création de l'écriture.
    const [rows] = await conn.query(
      'SELECT * FROM depenses WHERE id = ? AND user_id = ? FOR UPDATE',
      [req.params.id, uid]
    );
    const expense = rows[0];
    if (!expense) {
      await conn.rollback();
      return res.status(404).json({ error: 'Dépense introuvable.' });
    }

    // Une écriture déjà validée n'est jamais recalculée selon une correspondance
    // modifiée ou un compte devenu inactif : le rejeu renvoie l'écriture d'origine.
    const [existingEntries] = await conn.query(
      "SELECT id, numero FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'depense' AND source_id = ? LIMIT 1 FOR UPDATE",
      [uid, expense.id]
    );
    if (existingEntries.length) {
      await conn.commit();
      return res.status(200).json({
        id: existingEntries[0].id,
        numero: existingEntries[0].numero,
        duplicate: true
      });
    }

    const amount = Number(expense.montant);
    if (!Number.isFinite(amount) || amount <= 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Le montant de la dépense doit être positif avant comptabilisation.' });
    }
    await ensureAccountingDefaults(uid, conn);
    const expenseMapping = await requireExpenseCorrespondence(uid, expense.categorie, conn);
    const bank = expense.mode_reglement === 'banque';
    const result = await postSystemEntry(
      uid,
      actor(req),
      'depense',
      expense.id,
      expense.date_depense,
      'Dépense ' + expense.libelle,
      bank ? 'BQ' : 'CA',
      [
        { code: expenseMapping.code, libelle: expense.categorie || expense.libelle, debit: amount, credit: 0 },
        { code: bank ? '521' : '571', libelle: bank ? 'Règlement bancaire dépense' : 'Règlement caisse dépense', debit: 0, credit: amount }
      ],
      conn
    );
    await conn.commit();
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    if (err.code === 'DEPENSE_NON_COMPTABILISABLE') return res.status(404).json({ error: 'Dépense supprimée avant comptabilisation.' });
    if (err.code === 'DEPENSE_MODIFIEE') return res.status(409).json({ error: 'La dépense a changé; actualisez puis relancez la comptabilisation.' });
    if (err.status === 409 && err.code) return res.status(409).json({ error: err.message, code: err.code });
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.get('/clients/:id/portal', async (req, res, next) => {
  try {
    const uid = owner(req);
    const [clients] = await pool.query('SELECT id, nom, email FROM clients WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    if (!clients.length) return res.status(404).json({ error: 'Client introuvable.' });
    const [rows] = await pool.query(
      'SELECT id, expires_at, last_access_at, created_at FROM pro_customer_portal_access WHERE user_id = ? AND client_id = ? AND revoked_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [uid, req.params.id]
    );
    res.json({ client: clients[0], portail_actif: !!rows.length, acces: rows[0] || null });
  } catch (err) { next(err); }
});

router.post('/clients/:id/portal', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const uid = owner(req);
    await conn.beginTransaction();
    const [clients] = await conn.query('SELECT id, nom, email FROM clients WHERE id = ? AND user_id = ? FOR UPDATE', [req.params.id, uid]);
    const client = clients[0];
    if (!client) { await conn.rollback(); return res.status(404).json({ error: 'Client introuvable.' }); }
    if (!client.email) { await conn.rollback(); return res.status(400).json({ error: 'Ajoutez une adresse email au client avant de lui envoyer son portail.' }); }
    const baseUrl = String(process.env.APP_URL || '').replace(/\/$/, '');
    if (!baseUrl || !/^https:\/\//i.test(baseUrl)) {
      if (process.env.NODE_ENV === 'production') {
        await conn.rollback();
        return res.status(503).json({ error: 'APP_URL doit être une URL HTTPS publique avant de partager un portail client.' });
      }
    }
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 86400000);
    await conn.query(
      'UPDATE pro_customer_portal_access SET revoked_at = NOW() WHERE user_id = ? AND client_id = ? AND revoked_at IS NULL',
      [uid, client.id]
    );
    const [created] = await conn.query(
      'INSERT INTO pro_customer_portal_access (user_id, client_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [uid, client.id, hash, expiresAt]
    );
    const [[company]] = await conn.query('SELECT entreprise_nom FROM users WHERE id = ?', [uid]);
    await conn.commit();

    const url = baseUrl + '/portail-client.html#token=' + token;
    // Ne jamais écrire le lien secret dans les logs quand le SMTP est absent.
    // Le lien est remis à l'utilisateur uniquement dans la réponse HTTP (une seule fois).
    const smtpReady = isSmtpConfigured();
    let mail = { sent: false };
    let mailFailure = false;
    if (smtpReady) {
      try {
        mail = await sendMail({
          to: client.email,
          subject: 'Votre espace client sécurisé — ' + (company.entreprise_nom || 'SamaFacture Pro'),
          text: 'Bonjour ' + client.nom + ',\\n\\nVotre entreprise ' + (company.entreprise_nom || '') +
            ' vous donne accès à un espace sécurisé pour consulter vos factures, devis et paiements :\\n' +
            url + '\\n\\nCe lien est personnel, valable 30 jours et peut être révoqué par l’entreprise. Ne le transférez pas.\\n',
          html: '<p>Bonjour ' + htmlEscape(client.nom) + ',</p><p>Votre espace client sécurisé est prêt.</p><p><a href="' +
            htmlEscape(url) + '">Consulter mes factures et devis</a></p><p>Ce lien est personnel, valable 30 jours et révocable.</p>'
        });
      } catch (mailError) {
        mailFailure = true;
        console.warn('Invitation portail client non envoyée :', mailError.message);
      }
    }
    await audit(req, 'portail.client_invite', 'client', client.id, { access_id: created.insertId, email: client.email });
    res.status(201).json({
      success: true, email: client.email, sent: !!mail.sent, url,
      expires_at: expiresAt.toISOString(),
      warning: mail.sent ? 'Invitation envoyée. Le lien ne sera plus réaffiché.' : (mailFailure ? 'L’envoi email a échoué. Le lien est affiché une seule fois pour copie manuelle.' : (!smtpReady ? 'SMTP non configuré : lien affiché une seule fois pour copie manuelle.' : 'L’envoi email n’a pas été confirmé. Le lien est affiché une seule fois pour copie manuelle.'))
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    next(err);
  } finally { conn.release(); }
});

router.delete('/clients/:id/portal', async (req, res, next) => {
  try {
    const uid = owner(req);
    const [result] = await pool.query(
      'UPDATE pro_customer_portal_access SET revoked_at = NOW() WHERE user_id = ? AND client_id = ? AND revoked_at IS NULL',
      [uid, req.params.id]
    );
    await audit(req, 'portail.client_revoque', 'client', req.params.id, { acces_revoques: result.affectedRows });
    res.json({ success: true, acces_revoques: result.affectedRows });
  } catch (err) { next(err); }
});

router.get('/crm/overview', async (req, res, next) => {
  try {
    const uid = owner(req);
    const [[stats]] = await pool.query(
      `SELECT COUNT(*) AS total_activites,
        SUM(CASE WHEN statut = 'a_faire' THEN 1 ELSE 0 END) AS taches_ouvertes,
        SUM(CASE WHEN statut = 'a_faire' AND due_at IS NOT NULL AND due_at < NOW() THEN 1 ELSE 0 END) AS taches_en_retard
       FROM pro_crm_activities WHERE user_id = ?`,
      [uid]
    );
    const [upcoming] = await pool.query(
      `SELECT a.id, a.client_id, c.nom AS client_nom, a.type, a.titre, a.due_at, a.statut
       FROM pro_crm_activities a JOIN clients c ON c.id = a.client_id AND c.user_id = a.user_id
       WHERE a.user_id = ? AND a.statut = 'a_faire'
       ORDER BY a.due_at IS NULL, a.due_at ASC, a.id DESC LIMIT 20`,
      [uid]
    );
    res.json({ statistiques: stats, prochaines_taches: upcoming });
  } catch (err) { next(err); }
});

router.get('/crm/activities', async (req, res, next) => {
  try {
    const uid = owner(req), params = [uid];
    let where = 'a.user_id = ?';
    if (req.query.client_id) { where += ' AND a.client_id = ?'; params.push(Number(req.query.client_id)); }
    if (req.query.statut && ['a_faire','terminee','annulee'].includes(req.query.statut)) { where += ' AND a.statut = ?'; params.push(req.query.statut); }
    const limit = Math.min(300, Math.max(1, Number(req.query.limite) || 100));
    const [rows] = await pool.query(
      `SELECT a.id, a.client_id, c.nom AS client_nom, a.acteur_user_id, a.type, a.titre,
              a.description, a.statut, a.due_at, a.completed_at, a.created_at, a.updated_at
       FROM pro_crm_activities a JOIN clients c ON c.id = a.client_id AND c.user_id = a.user_id
       WHERE ${where} ORDER BY COALESCE(a.due_at, a.created_at) DESC, a.id DESC LIMIT ?`,
      [...params, limit]
    );
    res.json({ activites: rows });
  } catch (err) { next(err); }
});

router.post('/crm/activities', async (req, res, next) => {
  try {
    const uid = owner(req), clientId = Number(req.body.client_id);
    const types = ['note','appel','reunion','email','tache','relance'];
    const type = String(req.body.type || 'note');
    const titre = String(req.body.titre || '').trim().slice(0, 190);
    const description = optionalText(req.body.description, 10000);
    const dueAt = req.body.due_at ? new Date(req.body.due_at) : null;
    if (!idOk(clientId) || !types.includes(type) || !titre || (dueAt && Number.isNaN(dueAt.getTime()))) {
      return res.status(400).json({ error: 'Client, type, titre et date de rappel valide sont requis.' });
    }
    const [clients] = await pool.query('SELECT id FROM clients WHERE id = ? AND user_id = ?', [clientId, uid]);
    if (!clients.length) return res.status(404).json({ error: 'Client introuvable dans cette entreprise.' });
    const statut = type === 'tache' || dueAt ? 'a_faire' : 'terminee';
    const [result] = await pool.query(
      'INSERT INTO pro_crm_activities (user_id, client_id, acteur_user_id, type, titre, description, statut, due_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [uid, clientId, actor(req), type, titre, description, statut, dueAt, statut === 'terminee' ? new Date() : null]
    );
    await audit(req, 'crm.activite_creee', 'client', clientId, { activite_id: result.insertId, type });
    res.status(201).json({ id: result.insertId, client_id: clientId, type, titre, statut });
  } catch (err) { next(err); }
});

router.put('/crm/activities/:id', async (req, res, next) => {
  try {
    const uid = owner(req);
    const [rows] = await pool.query('SELECT id, statut FROM pro_crm_activities WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    if (!rows.length) return res.status(404).json({ error: 'Activité CRM introuvable.' });
    const current = rows[0], status = req.body.statut;
    if (status !== undefined && !['a_faire','terminee','annulee'].includes(status)) return res.status(400).json({ error: 'Statut CRM invalide.' });
    const title = req.body.titre === undefined ? null : String(req.body.titre).trim().slice(0, 190);
    if (title !== null && !title) return res.status(400).json({ error: 'Le titre ne peut pas être vide.' });
    const dueAt = req.body.due_at === undefined ? null : (req.body.due_at ? new Date(req.body.due_at) : null);
    if (dueAt && Number.isNaN(dueAt.getTime())) return res.status(400).json({ error: 'Date de rappel invalide.' });
    await pool.query(
      `UPDATE pro_crm_activities SET
       titre = COALESCE(?, titre),
       description = CASE WHEN ? = 1 THEN ? ELSE description END,
       statut = COALESCE(?, statut),
       completed_at = CASE WHEN COALESCE(?, statut) = 'terminee' THEN COALESCE(completed_at, NOW()) WHEN COALESCE(?, statut) <> 'terminee' THEN NULL ELSE completed_at END,
       due_at = CASE WHEN ? = 1 THEN ? ELSE due_at END
       WHERE id = ? AND user_id = ?`,
      [title, req.body.description !== undefined ? 1 : 0, optionalText(req.body.description,10000),
       status || null, status || null, status || null,
       req.body.due_at !== undefined ? 1 : 0, dueAt,
       req.params.id, uid]
    );
    await audit(req, 'crm.activite_modifiee', 'activite', req.params.id, { statut: status || current.statut });
    res.json({ success: true });
  } catch (err) { next(err); }
});

/* ---------------------- CONTEXTE ENTREPRISE ---------------------------- */
router.get('/company-context', async (req, res, next) => {
  try {
    const [[company]] = await pool.query(
      'SELECT devise, fuseau_horaire FROM users WHERE id = ? LIMIT 1',
      [owner(req)]
    );
    if (!company) return res.status(404).json({ error: 'Entreprise introuvable.' });
    res.set('Cache-Control', 'private, no-store');
    res.json({ devise: String(company.devise || 'FCFA').toUpperCase(), fuseau_horaire: company.fuseau_horaire || 'Africa/Dakar' });
  } catch (err) { next(err); }
});

/* ---------------------- PARAMÈTRES INTERNATIONAUX ---------------------- */
router.get('/localization', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT pays_code, langue, locale, devise, fuseau_horaire, format_date, regime_fiscal FROM users WHERE id = ?',
      [owner(req)]
    );
    if (!rows.length) return res.status(404).json({ error: 'Entreprise introuvable.' });
    res.json({
      parametres: rows[0],
      options: { pays: SUPPORTED_COUNTRIES, langues: ['fr','en'], devises: SUPPORTED_CURRENCIES, fuseaux: SUPPORTED_TIMEZONES, formats_date: ['dd/MM/yyyy','yyyy-MM-dd','MM/dd/yyyy'], regimes_fiscaux: ['standard','simplifie','franchise','autre'] }
    });
  } catch (err) { next(err); }
});

router.put('/localization', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req);
    const body = req.body || {};
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Le changement de devise partage le verrou de compte utilisé par les
    // créations de commandes, d'achats et de factures.
    const [[company]] = await conn.query(
      'SELECT devise FROM users WHERE id = ? FOR UPDATE',
      [uid]
    );
    if (!company) {
      await conn.rollback();
      return res.status(404).json({ error: 'Entreprise introuvable.' });
    }

    const currentCurrency = String(company.devise || 'FCFA').toUpperCase();
    const country = String(body.pays_code || 'SN').toUpperCase();
    const language = String(body.langue || 'fr').toLowerCase();
    const currency = body.devise === undefined || body.devise === null || String(body.devise).trim() === ''
      ? currentCurrency
      : String(body.devise).trim().toUpperCase();
    const timezone = String(body.fuseau_horaire || 'Africa/Dakar');
    const dateFormat = String(body.format_date || 'dd/MM/yyyy');
    const taxRegime = String(body.regime_fiscal || 'standard');
    if (!SUPPORTED_COUNTRIES.includes(country) || !['fr','en'].includes(language) ||
        !SUPPORTED_CURRENCIES.includes(currency) || !SUPPORTED_TIMEZONES.includes(timezone) ||
        !['dd/MM/yyyy','yyyy-MM-dd','MM/dd/yyyy'].includes(dateFormat) ||
        !['standard','simplifie','franchise','autre'].includes(taxRegime)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Un paramètre pays, langue, devise, fuseau horaire ou fiscalité est invalide.' });
    }
    const locale = language + '-' + country;

    if (currency !== currentCurrency) {
      const [[history]] = await conn.query(
        'SELECT (SELECT COUNT(*) FROM factures WHERE user_id = ?) AS factures, (SELECT COUNT(*) FROM depenses WHERE user_id = ?) AS depenses, (SELECT COUNT(*) FROM paiements WHERE user_id = ?) AS paiements, (SELECT COUNT(*) FROM pro_commandes_fournisseurs WHERE user_id = ?) AS achats, (SELECT COUNT(*) FROM pro_commandes WHERE user_id = ?) AS commandes, (SELECT COUNT(*) FROM pro_bons_livraison WHERE user_id = ?) AS livraisons, (SELECT COUNT(*) FROM pro_mouvements_stock WHERE user_id = ?) AS mouvements_stock, (SELECT COUNT(*) FROM pro_compta_ecritures WHERE user_id = ?) AS ecritures, (SELECT COUNT(*) FROM produits WHERE user_id = ?) AS produits, (SELECT COUNT(*) FROM factures_recurrentes WHERE user_id = ?) AS modeles_recurrents',
        [uid, uid, uid, uid, uid, uid, uid, uid, uid, uid]
      );
      const hasBusinessHistory = Object.values(history || {}).some(value => Number(value) > 0);
      if (hasBusinessHistory) {
        await conn.rollback();
        return res.status(409).json({
          error: 'La devise de base ne peut plus être modifiée après l’enregistrement de documents, produits tarifés, modèles récurrents ou mouvements financiers. Les anciennes écritures ne sont pas converties automatiquement.'
        });
      }
    }

    await conn.query(
      'UPDATE users SET pays_code = ?, langue = ?, locale = ?, devise = ?, fuseau_horaire = ?, format_date = ?, regime_fiscal = ? WHERE id = ?',
      [country, language, locale, currency, timezone, dateFormat, taxRegime, uid]
    );
    await conn.commit();
    await audit(req, 'entreprise.localisation_modifiee', 'entreprise', uid, { country, language, currency, timezone, dateFormat, taxRegime });
    res.json({ success: true, parametres: { pays_code: country, langue: language, locale, devise: currency, fuseau_horaire: timezone, format_date: dateFormat, regime_fiscal: taxRegime } });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    next(err);
  } finally {
    if (conn) conn.release();
  }
});
};
