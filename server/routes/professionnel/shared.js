const crypto = require('crypto');
const { decryptSecret } = require('../../utils/pro-webhooks');
const { isEnterprisePlan } = require('../../utils/plans');
const { localDateString } = require('../../utils/local-date');
const { pool } = require('../../config/db');

const owner = (req) => Number(req.tenantId);
const actor = (req) => Number(req.actorId || req.user.id);
const idOk = (value) => /^\d+$/.test(String(value || '')) && Number(value) > 0;
const money = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999999) return null;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

function paymentTreasuryAccount(method) {
  const normalized = String(method || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const bankMethods = new Set([
    'wave', 'orange money', 'paydunya', 'virement bancaire', 'virement',
    'cheque', 'carte bancaire', 'carte'
  ]);
  if (bankMethods.has(normalized)) return '521';
  if (['especes', 'cash'].includes(normalized)) return '571';
  return null;
}

async function safeDateForUser(value, userId) {
  const valid = optionalIsoDate(value);
  if (valid) return valid;
  const [accounts] = await pool.query(
    'SELECT fuseau_horaire FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  return localDateString(accounts?.[0]?.fuseau_horaire || 'Africa/Dakar');
}
function optionalText(value, maxLength) {
  if (value === undefined || value === null) return null;
  return String(value).trim().slice(0, maxLength) || null;
}
function optionalIsoDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const date = new Date(text + 'T00:00:00.000Z');
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? undefined : text;
}

const randomRef = (prefix) => prefix + '-' + new Date().getFullYear() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
const parseJson = (value, fallback) => {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return fallback; }
};

async function audit(req, action, entity, entityId, details) {
  try {
    await pool.query(
      'INSERT INTO pro_audit_logs (user_id, acteur_user_id, action, entite, entite_id, details_json, adresse_ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [owner(req), actor(req), action, entity, entityId == null ? null : String(entityId), details ? JSON.stringify(details) : null, req.ip || null]
    );
  } catch (err) {
    console.error('Écriture du journal professionnel impossible :', err.message);
  }
}

async function clientOwned(userId, clientId) {
  const [rows] = await pool.query('SELECT * FROM clients WHERE id = ? AND user_id = ? LIMIT 1', [clientId, userId]);
  return rows[0] || null;
}
async function invoiceOwned(userId, invoiceId) {
  const [rows] = await pool.query('SELECT * FROM factures WHERE id = ? AND user_id = ? LIMIT 1', [invoiceId, userId]);
  return rows[0] || null;
}


function parseCompanyGroupPagination(query) {
  const requested = query.page !== undefined || query.limit !== undefined;
  if (!requested) return null;
  const rawPage = query.page === undefined ? '1' : query.page;
  const rawLimit = query.limit === undefined ? '20' : query.limit;
  if (Array.isArray(rawPage) || Array.isArray(rawLimit) ||
      !/^\d+$/.test(String(rawPage)) || !/^\d+$/.test(String(rawLimit))) {
    return { error: 'Paramètres de pagination invalides.' };
  }
  const page = Number(rawPage);
  const limit = Number(rawLimit);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
    return { error: 'La page doit être positive et la limite comprise entre 1 et 50.' };
  }
  return { page, limit, offset: (page - 1) * limit };
}

function companyGroupPaginationMeta(total, pagination) {
  if (!pagination) return undefined;
  const totalPages = Math.ceil(total / pagination.limit);
  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages,
    from: total ? pagination.offset + 1 : 0,
    to: Math.min(pagination.offset + pagination.limit, total),
    hasPrevious: pagination.page > 1 && totalPages > 0,
    hasNext: pagination.page < totalPages
  };
}

async function assertEnterpriseGroupOwner(req, res) {
  // Le groupe appartient toujours au compte de connexion (actor), même si l'utilisateur
  // a actuellement sélectionné une filiale via X-SF-Company-Owner.
  const [rows] = await pool.query('SELECT plan FROM users WHERE id = ? LIMIT 1', [actor(req)]);
  if (!rows.length || !isEnterprisePlan(rows[0].plan)) {
    res.status(403).json({
      error: 'La gestion multi-sociétés est réservée à la formule Entreprise.',
      code: 'PLAN_ENTREPRISE_REQUIS'
    });
    return false;
  }
  return true;
}

async function postRefundAccountingEntry(conn, uid, actorId, payment, invoice, refund, entryDate) {
  // Garantir qu'un remboursement déclaré réellement effectué possède toujours
  // l'encaissement d'origine au journal. Les deux mouvements sont dans la même
  // transaction : impossible de laisser le grand livre dans un état intermédiaire.
  let [paymentEntries] = await conn.query(
    `SELECT e.id, e.journal_id, j.code AS journal_code
     FROM pro_compta_ecritures e
     JOIN pro_compta_journaux j ON j.id = e.journal_id AND j.user_id = e.user_id
     WHERE e.user_id = ? AND e.source_type = 'paiement' AND e.source_id = ?
     LIMIT 1 FOR UPDATE`,
    [uid, payment.id]
  );
  if (!paymentEntries.length) {
    const treasuryAccount = paymentTreasuryAccount(payment.methode);
    if (!treasuryAccount) {
      const error = new Error('La méthode du paiement d’origine ne permet pas de déterminer le compte de trésorerie. Le remboursement est bloqué pour éviter une écriture comptable incorrecte.');
      error.status = 409;
      error.code = 'METHODE_PAIEMENT_NON_RECONNUE';
      throw error;
    }
    const bank = treasuryAccount === '521';
    await postSystemEntry(
      uid,
      actorId,
      'paiement',
      payment.id,
      String(payment.date_paiement || entryDate).slice(0, 10),
      'Encaissement facture ' + invoice.numero,
      bank ? 'BQ' : 'CA',
      [
        { code: bank ? '521' : '571', libelle: 'Règlement ' + invoice.numero, debit: Number(payment.montant), credit: 0, paiement_id: payment.id, facture_id: invoice.id },
        { code: '411', libelle: 'Lettrage client ' + invoice.numero, debit: 0, credit: Number(payment.montant), paiement_id: payment.id, facture_id: invoice.id }
      ],
      conn
    );
    [paymentEntries] = await conn.query(
      `SELECT e.id, e.journal_id, j.code AS journal_code
       FROM pro_compta_ecritures e
       JOIN pro_compta_journaux j ON j.id = e.journal_id AND j.user_id = e.user_id
       WHERE e.user_id = ? AND e.source_type = 'paiement' AND e.source_id = ?
       LIMIT 1 FOR UPDATE`,
      [uid, payment.id]
    );
  }
  const paymentEntry = paymentEntries[0];
  if (!paymentEntry) throw new Error('Impossible de retrouver l’écriture comptable du paiement d’origine.');

  const [originalLines] = await conn.query(
    `SELECT c.code, l.debit, l.credit
     FROM pro_compta_lignes l
     JOIN pro_compta_comptes c ON c.id = l.compte_id AND c.user_id = l.user_id
     WHERE l.user_id = ? AND l.ecriture_id = ?
     ORDER BY l.id`,
    [uid, paymentEntry.id]
  );
  const expectedAmount = Math.round(Number(payment.montant) * 100) / 100;
  const treasuryLine = originalLines.find(line =>
    ['521', '571'].includes(String(line.code)) &&
    Number(line.debit) > 0 && Number(line.credit) === 0
  );
  const customerLine = originalLines.find(line =>
    String(line.code) === '411' &&
    Number(line.credit) > 0 && Number(line.debit) === 0
  );
  if (originalLines.length !== 2 || !treasuryLine || !customerLine ||
      Math.abs(Number(treasuryLine.debit) - expectedAmount) > 0.01 ||
      Math.abs(Number(customerLine.credit) - expectedAmount) > 0.01 ||
      !['BQ', 'CA'].includes(paymentEntry.journal_code)) {
    const error = new Error('L’écriture d’origine ne présente pas les deux lignes attendues (trésorerie et client). Le remboursement est bloqué pour éviter une contrepassation incorrecte.');
    error.status = 409;
    error.code = 'ECRITURE_PAIEMENT_NON_REVERSIBLE';
    throw error;
  }

  const refundAmount = Math.round(Number(refund.montant) * 100) / 100;
  if (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount > expectedAmount + 0.001) {
    const error = new Error('Le montant du remboursement ne correspond pas à un montant valide du paiement d’origine.');
    error.status = 409;
    error.code = 'MONTANT_REMBOURSEMENT_INVALIDE';
    throw error;
  }

  return postSystemEntry(
    uid,
    actorId,
    'remboursement',
    refund.id,
    entryDate,
    'Remboursement facture ' + invoice.numero,
    paymentEntry.journal_code,
    [
      {
        code: customerLine.code,
        libelle: 'Annulation du lettrage client ' + invoice.numero,
        debit: refundAmount,
        credit: 0,
        paiement_id: payment.id,
        facture_id: invoice.id
      },
      {
        code: treasuryLine.code,
        libelle: 'Sortie de trésorerie — remboursement ' + (refund.reference_prestataire || refund.id),
        debit: 0,
        credit: refundAmount,
        paiement_id: payment.id,
        facture_id: invoice.id
      }
    ],
    conn
  );
}


/* ---------------- PAIEMENTS EN LIGNE DES FACTURES ---------------------- */
async function lireGateway(uid, provider) {
  const [rows] = await pool.query(
    'SELECT credentials_enc, mode, actif FROM pro_payment_gateways WHERE user_id = ? AND fournisseur = ? LIMIT 1',
    [uid, provider]
  );
  if (!rows.length || !rows[0].actif) return null;
  return { ...JSON.parse(decryptSecret(rows[0].credentials_enc)), PAYDUNYA_MODE: rows[0].mode || 'test' };
}

/* ------------------------- FOURNISSEURS & ACHATS ------------------------ */
async function ensureDefaultWarehouse(uid) {
  const userId = Number(uid);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error('Identifiant utilisateur invalide pour initialiser le magasin principal.');
  }

  // Plusieurs requêtes métier peuvent demander le magasin principal en même temps.
  // Le verrou nommé MySQL sérialise le backfill par entreprise, sur tous les workers.
  const lockName = 'sunupilot:default-warehouse:' + userId;
  const conn = await pool.getConnection();
  let lockAcquired = false;
  let transactionStarted = false;
  try {
    const [[lock]] = await conn.query('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
    if (Number(lock?.acquired) !== 1) {
      throw new Error('Impossible de verrouiller l’initialisation du magasin principal. Réessayez.');
    }
    lockAcquired = true;

    await conn.beginTransaction();
    transactionStarted = true;
    await conn.query(
      "INSERT IGNORE INTO pro_entrepots (user_id, code, nom, par_defaut) VALUES (?, 'PRINCIPAL', 'Magasin principal', 1)",
      [userId]
    );
    const [[warehouse]] = await conn.query(
      'SELECT id, backfill_stock_termine FROM pro_entrepots WHERE user_id = ? AND code = ? LIMIT 1 FOR UPDATE',
      [userId, 'PRINCIPAL']
    );
    if (!warehouse) throw new Error('Impossible de retrouver le magasin principal après son initialisation.');

    // Un autre parcours (ex. facture récurrente) peut avoir créé le magasin avant cet appel.
    // Le marqueur représente l'état réel du backfill, et non le résultat de INSERT IGNORE.
    // Le verrou nommé + la transaction rendent la reprise unique, atomique et réessayable.
    if (Number(warehouse.backfill_stock_termine) !== 1) {
      await conn.query(
        `INSERT IGNORE INTO pro_stocks_entrepots (user_id, entrepot_id, produit_id, quantite)
         SELECT p.user_id, ?, p.id, GREATEST(0, p.stock - COALESCE(existing.total, 0))
         FROM produits p
         LEFT JOIN (
           SELECT produit_id, SUM(quantite) AS total
           FROM pro_stocks_entrepots
           WHERE user_id = ?
           GROUP BY produit_id
         ) existing ON existing.produit_id = p.id
         WHERE p.user_id = ?
           AND COALESCE(p.type_catalogue, 'non_classe') <> 'service'`,
        [warehouse.id, userId, userId]
      );
      await conn.query(
        'UPDATE pro_entrepots SET backfill_stock_termine = 1 WHERE id = ? AND user_id = ?',
        [warehouse.id, userId]
      );
    }

    await conn.commit();
    transactionStarted = false;
    return Number(warehouse.id);
  } catch (err) {
    if (transactionStarted) {
      try { await conn.rollback(); } catch (_) { /* Conserver l'erreur initiale. */ }
    }
    throw err;
  } finally {
    let discardConnection = false;
    if (lockAcquired) {
      try {
        await conn.query('SELECT RELEASE_LOCK(?)', [lockName]);
      } catch (_) {
        // Détruire la connexion force MySQL à libérer tout verrou nommé restant.
        discardConnection = true;
      }
    }
    if (discardConnection) conn.destroy();
    else conn.release();
  }
}

/* --------------------------- COMPTABILITE OHADA ------------------------- */
const OHADA_STARTER_ACCOUNTS = [
  ['101','Capital social',1,'credit',0],['12','Résultat net de l’exercice',1,'credit',0],
  ['21','Immobilisations corporelles',2,'debit',0],['28','Amortissements',2,'credit',0],
  ['31','Stocks de marchandises',3,'debit',0],['37','Stocks de produits',3,'debit',0],
  ['401','Fournisseurs',4,'credit',1],['411','Clients',4,'debit',1],['421','Personnel, rémunérations dues',4,'credit',1],
  ['443','État, TVA facturée',4,'credit',0],['445','État, TVA récupérable',4,'debit',0],
  ['521','Banques',5,'debit',0],['571','Caisse',5,'debit',0],
  ['601','Achats de marchandises',6,'debit',0],['604','Achats de matières et fournitures',6,'debit',0],
  ['6181','Voyages et déplacements',6,'debit',0],['622','Locations et charges locatives',6,'debit',0],['625','Primes d’assurance',6,'debit',0],['641','Rémunérations du personnel',6,'debit',0],
  ['638','Autres charges externes',6,'debit',0],['661','Charges d’intérêts',6,'debit',0],['701','Ventes de marchandises',7,'credit',0],
  ['702','Ventes de produits finis',7,'credit',0],['703','Ventes de produits intermédiaires',7,'credit',0],
  ['704','Ventes de produits résiduels',7,'credit',0],['705','Travaux facturés',7,'credit',0],
  ['706','Services vendus',7,'credit',0],['707','Produits accessoires',7,'credit',0],['758','Produits divers',7,'credit',0]
];


const ACCOUNTING_SALE_MAPPING_KEYS = Object.freeze([
  'produit', 'service', 'non_classe', 'saisie_libre', 'frais_livraison'
]);

function normalizeAccountingCategoryKey(value) {
  return String(value == null ? '' : value)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 100);
}

function accountingMappingError(message, code = 'CORRESPONDANCE_COMPTABLE_MANQUANTE') {
  const error = new Error(message);
  error.status = 409;
  error.code = code;
  return error;
}

async function findAccountingCorrespondence(uid, sourceType, sourceKey, conn = pool) {
  const [rows] = await conn.query(
    'SELECT m.id, m.compte_id, m.type_source, m.cle_source, c.code, c.libelle, c.classe, c.actif FROM pro_compta_correspondances m JOIN pro_compta_comptes c ON c.id = m.compte_id AND c.user_id = m.user_id WHERE m.user_id = ? AND m.type_source = ? AND m.cle_source = ? LIMIT 1',
    [uid, sourceType, sourceKey]
  );
  return rows[0] || null;
}

async function requireAccountingCorrespondence(uid, sourceType, sourceKey, conn = pool) {
  const mapping = await findAccountingCorrespondence(uid, sourceType, sourceKey, conn);
  if (!mapping) {
    throw accountingMappingError(
      'Aucune correspondance comptable n’est configurée pour ' + sourceType + ' / ' + sourceKey + '.',
      'CORRESPONDANCE_COMPTABLE_MANQUANTE'
    );
  }
  const expectedClass = sourceType === 'vente' ? 7 : 6;
  if (Number(mapping.actif) !== 1) {
    throw accountingMappingError(
      'Le compte ' + mapping.code + ' affecté à ' + sourceKey + ' est inactif. Choisissez un compte actif.',
      'COMPTE_CORRESPONDANCE_INACTIF'
    );
  }
  if (Number(mapping.classe) !== expectedClass) {
    throw accountingMappingError(
      'Le compte affecté à ' + sourceKey + ' doit appartenir à la classe ' + expectedClass + '.',
      'CLASSE_COMPTE_CORRESPONDANCE_INVALIDE'
    );
  }
  return mapping;
}

async function requireExpenseCorrespondence(uid, category, conn = pool) {
  const key = normalizeAccountingCategoryKey(category);
  if (key) {
    const specific = await findAccountingCorrespondence(uid, 'depense', key, conn);
    if (specific) {
      if (Number(specific.actif) !== 1 || Number(specific.classe) !== 6) {
        throw accountingMappingError(
          'Le compte affecté à la catégorie « ' + key + ' » est inactif ou n’appartient plus à la classe 6.',
          'CORRESPONDANCE_DEPENSE_INVALIDE'
        );
      }
      return specific;
    }
  }
  return requireAccountingCorrespondence(uid, 'depense', '__default__', conn);
}

function amountToCents(value, field) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0 || number > 999999999999) {
    throw accountingMappingError('Montant invalide pour ' + field + '.', 'MONTANT_COMPTABLE_INVALIDE');
  }
  return BigInt(Math.round(number * 100));
}

function invoiceLineToCents(quantity, unitPrice) {
  const qty = Number(quantity), price = Number(unitPrice);
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
    throw accountingMappingError('Une ligne de facture possède une quantité ou un prix invalide.', 'LIGNE_FACTURE_INVALIDE');
  }
  const qtyHundredths = BigInt(Math.round(qty * 100));
  const priceCents = BigInt(Math.round(price * 100));
  return (qtyHundredths * priceCents + 50n) / 100n;
}

function allocateCentsProportionally(totalCents, groups) {
  const totalWeight = groups.reduce((sum, group) => sum + group.weight, 0n);
  if (totalCents === 0n) return groups.map(() => 0n);
  if (totalWeight <= 0n || totalCents < 0n || totalCents > totalWeight) {
    throw accountingMappingError('La remise ne peut pas être répartie sur les lignes de vente.', 'REMISE_FACTURE_INVALIDE');
  }
  const allocations = groups.map((group, index) => {
    const numerator = totalCents * group.weight;
    return { index, cents: numerator / totalWeight, remainder: numerator % totalWeight };
  });
  let remaining = totalCents - allocations.reduce((sum, allocation) => sum + allocation.cents, 0n);
  const order = [...allocations].sort((a, b) => {
    if (a.remainder === b.remainder) return a.index - b.index;
    return a.remainder > b.remainder ? -1 : 1;
  });
  for (const allocation of order) {
    if (remaining <= 0n) break;
    allocation.cents += 1n;
    remaining -= 1n;
  }
  if (remaining !== 0n) throw accountingMappingError('Répartition de remise incomplète.', 'REMISE_FACTURE_INVALIDE');
  return allocations.map(allocation => allocation.cents);
}

async function buildInvoiceAccountingLines(uid, invoice, conn) {
  const [invoiceRows] = await conn.query(
    'SELECT fl.id, fl.produit_id, fl.quantite, fl.prix_unitaire, p.type_catalogue FROM facture_lignes fl LEFT JOIN produits p ON p.id = fl.produit_id AND p.user_id = ? WHERE fl.facture_id = ? ORDER BY fl.id',
    [uid, invoice.id]
  );
  if (!invoiceRows.length) {
    throw accountingMappingError('La facture ne contient aucune ligne comptabilisable.', 'FACTURE_SANS_LIGNE');
  }

  const groups = new Map();
  for (const row of invoiceRows) {
    if (row.produit_id && row.type_catalogue == null) {
      throw accountingMappingError(
        'Une ligne référence un produit qui n’appartient pas à cette entreprise. Comptabilisation refusée.',
        'PRODUIT_FACTURE_NON_AUTORISE'
      );
    }
    const currentType = String(row.type_catalogue || 'non_classe');
    const sourceKey = row.produit_id
      ? (['produit', 'service'].includes(currentType) ? currentType : 'non_classe')
      : 'saisie_libre';
    const cents = invoiceLineToCents(row.quantite, row.prix_unitaire);
    // Une ligne sans montant HT n'apporte aucun produit ; elle ne doit pas forcer
    // une classification commerciale (ex. facture avec seuls frais de livraison).
    if (cents === 0n) continue;
    const mapping = await requireAccountingCorrespondence(uid, 'vente', sourceKey, conn);
    const groupKey = String(mapping.compte_id);
    const group = groups.get(groupKey) || {
      compte_id: Number(mapping.compte_id),
      code: mapping.code,
      libelle: mapping.libelle,
      weight: 0n
    };
    group.weight += cents;
    groups.set(groupKey, group);
  }

  const grouped = [...groups.values()];
  const lineSubtotal = grouped.reduce((sum, group) => sum + group.weight, 0n);
  const invoiceSubtotal = amountToCents(invoice.sous_total, 'sous-total facture');
  if (lineSubtotal !== invoiceSubtotal) {
    throw accountingMappingError(
      'Le total HT des lignes ne correspond pas au sous-total enregistré. Vérifiez la facture avant comptabilisation.',
      'SOUS_TOTAL_FACTURE_INCOHERENT'
    );
  }
  const discount = amountToCents(invoice.remise, 'remise facture');
  const shipping = amountToCents(invoice.frais_livraison, 'frais de livraison');
  const tax = amountToCents(invoice.total_tva, 'TVA facture');
  const total = amountToCents(invoice.total, 'total facture');
  if (discount > invoiceSubtotal || invoiceSubtotal - discount + shipping + tax !== total) {
    throw accountingMappingError(
      'Les totaux HT, remise, livraison, TVA et TTC de la facture sont incohérents.',
      'TOTAUX_FACTURE_INCOHERENTS'
    );
  }

  if (total === 0n) {
    throw accountingMappingError(
      'Cette facture a un total nul ; une écriture automatique équilibrée ne peut pas être créée avec les correspondances actuelles. Vérifiez la remise et les frais avant validation comptable.',
      'FACTURE_TOTAL_NUL'
    );
  }
  const allocations = allocateCentsProportionally(discount, grouped);
  const lines = [{
    code: '411',
    libelle: 'Client ' + invoice.numero,
    debit: Number(total) / 100,
    credit: 0,
    facture_id: invoice.id
  }];
  for (let index = 0; index < grouped.length; index++) {
    const netCents = grouped[index].weight - allocations[index];
    if (netCents <= 0n) continue;
    lines.push({
      code: grouped[index].code,
      libelle: 'Vente ' + grouped[index].libelle + ' — facture ' + invoice.numero,
      debit: 0,
      credit: Number(netCents) / 100,
      facture_id: invoice.id
    });
  }
  if (tax > 0n) {
    lines.push({
      code: '443',
      libelle: 'TVA facture ' + invoice.numero,
      debit: 0,
      credit: Number(tax) / 100,
      facture_id: invoice.id
    });
  }
  if (shipping > 0n) {
    const shippingMapping = await requireAccountingCorrespondence(uid, 'vente', 'frais_livraison', conn);
    lines.push({
      code: shippingMapping.code,
      libelle: 'Frais de livraison facture ' + invoice.numero,
      debit: 0,
      credit: Number(shipping) / 100,
      facture_id: invoice.id
    });
  }
  return lines;
}

async function ensureAccountingDefaults(uid, conn = pool) {
  for (const [code, label, classe, nature, lettrable] of OHADA_STARTER_ACCOUNTS) {
    await conn.query(
      'INSERT IGNORE INTO pro_compta_comptes (user_id, code, libelle, classe, nature, lettrable) VALUES (?, ?, ?, ?, ?, ?)',
      [uid, code, label, classe, nature, lettrable]
    );
  }
  const journals = [['VE','Ventes','vente'],['AC','Achats','achat'],['BQ','Banque','banque'],['CA','Caisse','caisse'],['OD','Opérations diverses','od']];
  for (const [code, label, type] of journals) {
    await conn.query('INSERT IGNORE INTO pro_compta_journaux (user_id, code, libelle, type) VALUES (?, ?, ?, ?)', [uid, code, label, type]);
  }

  // Correspondances initiales compatibles avec le comportement historique.
  // INSERT IGNORE ne remplace jamais les choix personnalisés de l'entreprise.
  const defaultMappings = [
    ['vente', 'produit', '701'],
    ['vente', 'service', '706'],
    ['vente', 'frais_livraison', '707'],
    ['depense', '__default__', '638']
  ];
  for (const [sourceType, sourceKey, accountCode] of defaultMappings) {
    const account = await accountId(uid, accountCode, conn);
    await conn.query(
      'INSERT IGNORE INTO pro_compta_correspondances (user_id, type_source, cle_source, compte_id) VALUES (?, ?, ?, ?)',
      [uid, sourceType, sourceKey, account]
    );
  }
}

async function accountId(uid, code, conn = pool) {
  const [rows] = await conn.query('SELECT id FROM pro_compta_comptes WHERE user_id = ? AND code = ? AND actif = 1 LIMIT 1', [uid, code]);
  if (!rows.length) throw new Error('Compte comptable ' + code + ' introuvable.');
  return Number(rows[0].id);
}

async function journalId(uid, code, conn = pool) {
  const [rows] = await conn.query('SELECT id FROM pro_compta_journaux WHERE user_id = ? AND code = ? AND actif = 1 LIMIT 1', [uid, code]);
  if (!rows.length) throw new Error('Journal ' + code + ' introuvable.');
  return Number(rows[0].id);
}

async function postSystemEntry(uid, actorId, sourceType, sourceId, date, label, journalCode, lines, existingConnection = null) {
  const ownsConnection = !existingConnection;
  const conn = existingConnection || await pool.getConnection();
  try {
    await ensureAccountingDefaults(uid, conn);
    if (ownsConnection) await conn.beginTransaction();

    if (sourceType === 'facture') {
      // Verrou commun avec DELETE /factures/:id : aucun posting ne peut se créer
      // après une vérification d'absence d'historique suivie d'une suppression.
      const [invoiceRows] = await conn.query(
        "SELECT id FROM factures WHERE id = ? AND user_id = ? AND type = 'facture' AND statut <> 'annulee' FOR UPDATE",
        [sourceId, uid]
      );
      if (!invoiceRows.length) {
        const err = new Error('Facture introuvable, supprimée ou annulée.');
        err.code = 'FACTURE_NON_COMPTABILISABLE';
        throw err;
      }
    }
    if (sourceType === 'depense') {
      // Verrou commun avec PUT/DELETE /depenses et contrôle de cohérence de la source.
      const [expenseRows] = await conn.query(
        'SELECT id, montant, date_depense, libelle, categorie FROM depenses WHERE id = ? AND user_id = ? FOR UPDATE',
        [sourceId, uid]
      );
      const expense = expenseRows[0];
      if (!expense) {
        const err = new Error('Dépense introuvable ou supprimée.');
        err.code = 'DEPENSE_NON_COMPTABILISABLE';
        throw err;
      }
      const expectedAmount = Number(expense.montant);
      const debitAmount = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
      const creditAmount = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
      const expectedLabel = expense.categorie || expense.libelle;
      if (Math.abs(debitAmount - expectedAmount) > 0.01 ||
          Math.abs(creditAmount - expectedAmount) > 0.01 ||
          String(date).slice(0, 10) !== String(expense.date_depense).slice(0, 10) ||
          label !== 'Dépense ' + expense.libelle ||
          lines[0]?.libelle !== expectedLabel) {
        const err = new Error('La dépense a été modifiée avant sa comptabilisation; relancez la comptabilisation.');
        err.code = 'DEPENSE_MODIFIEE';
        throw err;
      }
    }

    const [existing] = await conn.query(
      'SELECT id, numero FROM pro_compta_ecritures WHERE user_id = ? AND source_type = ? AND source_id = ? LIMIT 1 FOR UPDATE',
      [uid, sourceType, sourceId]
    );
    if (existing.length) {
      if (ownsConnection) await conn.commit();
      return { id: existing[0].id, numero: existing[0].numero, duplicate: true };
    }

    const journal = await journalId(uid, journalCode, conn);
    let debit = 0, credit = 0;
    for (const line of lines) {
      if (line.debit < 0 || line.credit < 0 || (line.debit > 0 && line.credit > 0) || (!line.debit && !line.credit)) {
        throw new Error('Ligne comptable invalide.');
      }
      debit += line.debit;
      credit += line.credit;
    }
    debit = Math.round(debit * 100) / 100;
    credit = Math.round(credit * 100) / 100;
    if (Math.abs(debit - credit) > 0.01) throw new Error('Écriture déséquilibrée.');

    const numero = randomRef('ECR');
    const [entry] = await conn.query(
      "INSERT INTO pro_compta_ecritures (user_id, journal_id, numero, date_ecriture, reference, libelle, source_type, source_id, statut, total_debit, total_credit, acteur_user_id, validee_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'validee', ?, ?, ?, NOW())",
      [uid, journal, numero, date, String(sourceId), label.slice(0,255), sourceType, sourceId, debit, credit, actorId]
    );
    for (const line of lines) {
      const account = await accountId(uid, line.code, conn);
      await conn.query(
        'INSERT INTO pro_compta_lignes (user_id, ecriture_id, compte_id, libelle, debit, credit, tiers, facture_id, paiement_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uid, entry.insertId, account, line.libelle || label, line.debit || 0, line.credit || 0, line.tiers || null, line.facture_id || null, line.paiement_id || null]
      );
    }
    if (ownsConnection) await conn.commit();
    return { id: entry.insertId, numero, duplicate: false };
  } catch (err) {
    if (ownsConnection) await conn.rollback().catch(() => {});
    if (err.code === 'ER_DUP_ENTRY') {
      const lookup = ownsConnection ? pool : conn;
      const [rows] = await lookup.query(
        'SELECT id, numero FROM pro_compta_ecritures WHERE user_id = ? AND source_type = ? AND source_id = ? LIMIT 1',
        [uid, sourceType, sourceId]
      );
      if (rows.length) return { id: rows[0].id, numero: rows[0].numero, duplicate: true };
    }
    throw err;
  } finally {
    if (ownsConnection) conn.release();
  }
}


/* ----------------------- PORTAIL CLIENT & CRM -------------------------- */
function htmlEscape(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

module.exports = {
  ACCOUNTING_SALE_MAPPING_KEYS,
  actor,
  assertEnterpriseGroupOwner,
  audit,
  buildInvoiceAccountingLines,
  clientOwned,
  companyGroupPaginationMeta,
  ensureAccountingDefaults,
  ensureDefaultWarehouse,
  htmlEscape,
  idOk,
  invoiceOwned,
  lireGateway,
  money,
  normalizeAccountingCategoryKey,
  optionalIsoDate,
  optionalText,
  owner,
  parseCompanyGroupPagination,
  parseJson,
  paymentTreasuryAccount,
  postRefundAccountingEntry,
  postSystemEntry,
  randomRef,
  requireExpenseCorrespondence,
  safeDateForUser
};
