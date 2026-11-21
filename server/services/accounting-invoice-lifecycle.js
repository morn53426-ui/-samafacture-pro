'use strict';

const crypto = require('crypto');
const { localDateString } = require('../utils/local-date');

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Contre-passe la dernière écriture de cycle de vie d'une facture.
 * L'appelant doit déjà verrouiller la ligne facture avec SELECT ... FOR UPDATE
 * et exécuter cette fonction dans la même transaction que le changement de statut.
 *
 * transition = "annulation" : inverse l'écriture de facture actuellement active.
 * transition = "reactivation" : inverse la dernière contrepassation d'annulation.
 *
 * Aucun mouvement n'est créé si la facture n'a jamais été comptabilisée.
 */
async function recordInvoiceAccountingTransition(conn, {
  userId,
  actorUserId,
  invoice,
  transition
}) {
  if (!['annulation', 'reactivation'].includes(transition)) {
    throw new TypeError('Transition comptable de facture invalide.');
  }
  if (!invoice || !invoice.id || !invoice.numero) {
    throw new TypeError('Facture complète requise pour la contrepassation.');
  }

  const [originalRows] = await conn.query(
    "SELECT id, journal_id FROM pro_compta_ecritures WHERE user_id = ? AND source_type = 'facture' AND source_id = ? LIMIT 1 FOR UPDATE",
    [userId, invoice.id]
  );
  const original = originalRows[0];
  if (!original) {
    return { recorded: false, reason: 'FACTURE_NON_COMPTABILISEE' };
  }

  const [eventRows] = await conn.query(
    'SELECT id, transition, previous_ecriture_id, ecriture_id FROM pro_compta_facture_events WHERE user_id = ? AND facture_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE',
    [userId, invoice.id]
  );
  const latestEvent = eventRows[0] || null;
  const currentlyReversed = latestEvent?.transition === 'annulation';

  if (transition === 'annulation' && currentlyReversed) {
    return { recorded: false, duplicate: true, reason: 'FACTURE_DEJA_CONTREPASSEE' };
  }
  if (transition === 'reactivation' && !currentlyReversed) {
    return { recorded: false, duplicate: true, reason: 'FACTURE_NON_CONTREPASSEE' };
  }

  if (latestEvent && !latestEvent.ecriture_id) {
    throw new Error('La dernière transition comptable de cette facture est incomplète ; contrepassation refusée.');
  }
  const previousEntryId = latestEvent ? latestEvent.ecriture_id : original.id;
  if (!previousEntryId) {
    throw new Error('Écriture comptable précédente introuvable pour cette facture.');
  }

  const [entryRows] = await conn.query(
    'SELECT id, journal_id, total_debit, total_credit FROM pro_compta_ecritures WHERE id = ? AND user_id = ? AND statut = ? LIMIT 1 FOR UPDATE',
    [previousEntryId, userId, 'validee']
  );
  const previousEntry = entryRows[0];
  if (!previousEntry) {
    throw new Error('La dernière écriture comptable de cette facture est introuvable ou non validée.');
  }

  const [lines] = await conn.query(
    'SELECT compte_id, libelle, debit, credit, tiers, facture_id, paiement_id FROM pro_compta_lignes WHERE ecriture_id = ? AND user_id = ? ORDER BY id',
    [previousEntry.id, userId]
  );
  if (lines.length < 2) {
    throw new Error('La dernière écriture comptable ne contient pas assez de lignes pour être contre-passée.');
  }

  const previousDebit = round2(lines.reduce((sum, line) => sum + Number(line.debit || 0), 0));
  const previousCredit = round2(lines.reduce((sum, line) => sum + Number(line.credit || 0), 0));
  if (Math.abs(previousDebit - previousCredit) > 0.01) {
    throw new Error('La dernière écriture comptable de la facture est déséquilibrée ; contrepassation refusée.');
  }

  const reversalLines = lines.map(line => ({
    compte_id: line.compte_id,
    libelle: (transition === 'annulation' ? 'Annulation facture ' : 'Réactivation facture ') + invoice.numero,
    debit: round2(Number(line.credit || 0)),
    credit: round2(Number(line.debit || 0)),
    tiers: line.tiers || null,
    facture_id: invoice.id,
    paiement_id: line.paiement_id || null
  }));
  const totalDebit = round2(reversalLines.reduce((sum, line) => sum + line.debit, 0));
  const totalCredit = round2(reversalLines.reduce((sum, line) => sum + line.credit, 0));
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error('La contrepassation générée est déséquilibrée.');
  }

  const [[account]] = await conn.query(
    'SELECT fuseau_horaire FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  const date = localDateString(account?.fuseau_horaire || 'Africa/Dakar');
  const eventLabel = transition === 'annulation'
    ? 'Contrepassation annulation facture '
    : 'Contrepassation réactivation facture ';
  const sourceType = transition === 'annulation'
    ? 'facture_annulation'
    : 'facture_reactivation';

  const [eventResult] = await conn.query(
    'INSERT INTO pro_compta_facture_events (user_id, facture_id, transition, previous_ecriture_id) VALUES (?, ?, ?, ?)',
    [userId, invoice.id, transition, previousEntry.id]
  );
  const eventId = eventResult.insertId;
  const numero = 'ECR-' + new Date().getFullYear() + '-' +
    crypto.randomBytes(4).toString('hex').toUpperCase();

  const [entryResult] = await conn.query(
    "INSERT INTO pro_compta_ecritures (user_id, journal_id, numero, date_ecriture, reference, libelle, source_type, source_id, statut, total_debit, total_credit, acteur_user_id, validee_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'validee', ?, ?, ?, NOW())",
    [
      userId,
      previousEntry.journal_id,
      numero,
      date,
      invoice.numero,
      eventLabel + invoice.numero,
      sourceType,
      eventId,
      totalDebit,
      totalCredit,
      actorUserId || null
    ]
  );

  for (const line of reversalLines) {
    await conn.query(
      'INSERT INTO pro_compta_lignes (user_id, ecriture_id, compte_id, libelle, debit, credit, tiers, facture_id, paiement_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        userId,
        entryResult.insertId,
        line.compte_id,
        line.libelle,
        line.debit,
        line.credit,
        line.tiers,
        line.facture_id,
        line.paiement_id
      ]
    );
  }

  await conn.query(
    'UPDATE pro_compta_facture_events SET ecriture_id = ? WHERE id = ? AND user_id = ?',
    [entryResult.insertId, eventId, userId]
  );

  return {
    recorded: true,
    id: entryResult.insertId,
    event_id: eventId,
    numero,
    transition,
    total_debit: totalDebit,
    total_credit: totalCredit
  };
}

module.exports = { recordInvoiceAccountingTransition };
