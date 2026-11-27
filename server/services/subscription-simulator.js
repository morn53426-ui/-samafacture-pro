'use strict';

const crypto = require('node:crypto');

function parseCivilDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError('La date doit respecter le format YYYY-MM-DD.');
  }

  const [year, month, day] = value.split('-').map(Number);
  if (year < 1900 || year > 9999 || month < 1 || month > 12) {
    throw new RangeError('Date civile hors plage.');
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) {
    throw new RangeError('Date civile inexistante.');
  }

  return { year, month, day };
}

function formatCivilDate(year, month, day) {
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0')
  ].join('-');
}

/**
 * Calcule la fin exclusive de la prochaine période mensuelle.
 * anchorDay reste celui du début initial (ex. 31) afin qu'une période
 * raccourcie en février revienne au 31 en mars lorsque le mois le permet.
 *
 * Aucun fuseau n'est appliqué ici : les périodes sont des dates civiles.
 * L'heure réelle de prélèvement et le fuseau du compte restent gérés séparément.
 */
function nextMonthlyPeriod(periodStart, anchorDay) {
  const start = parseCivilDate(periodStart);
  const anchor = anchorDay === undefined ? start.day : Number(anchorDay);
  if (!Number.isInteger(anchor) || anchor < 1 || anchor > 31) {
    throw new RangeError('Le jour d’ancrage doit être compris entre 1 et 31.');
  }

  const monthIndex = start.year * 12 + (start.month - 1) + 1;
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  const daysInTargetMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDay = Math.min(anchor, daysInTargetMonth);

  return {
    periodStart,
    periodEnd: formatCivilDate(year, month, endDay),
    anchorDay: anchor
  };
}

function buildPeriodIdempotencyKey(subscriptionId, periodStart) {
  const id = String(subscriptionId);
  if (!/^[1-9]\d*$/.test(id)) {
    throw new TypeError('Identifiant d’abonnement invalide.');
  }
  parseCivilDate(periodStart);
  return crypto
    .createHash('sha256')
    .update('samafacture-saas-period:v1:' + id + ':' + periodStart, 'utf8')
    .digest('hex');
}

function parseInstant(value, fieldName) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new TypeError(fieldName + ' invalide.');
    return value;
  }
  const match = typeof value === 'string'
    ? value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/)
    : null;
  if (!match) {
    throw new TypeError(fieldName + ' doit inclure un fuseau explicite (Z ou ±HH:MM).');
  }
  parseCivilDate(match[1]);
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const second = Number(match[4]);
  if (hour > 23 || minute > 59 || second > 59) {
    throw new TypeError(fieldName + ' contient une heure invalide.');
  }
  if (match[6] !== 'Z') {
    const offsetHour = Number(match[6].slice(1, 3));
    const offsetMinute = Number(match[6].slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) {
      throw new TypeError(fieldName + ' contient un décalage horaire invalide.');
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(fieldName + ' invalide.');
  return parsed;
}

/**
 * Évalue une échéance à des fins de simulation uniquement.
 * Cette fonction est pure : aucun accès DB, aucune API fournisseur, aucun débit,
 * aucune création de période/tentative et aucune modification de users.plan.
 *
 * Un mandat réel "authorized" n'est volontairement pas accepté ici :
 * la simulation exige un faux mandat portant le statut simulation_authorized.
 */
function evaluateRenewalSimulation({ subscription, now, simulationEnabled } = {}) {
  const reject = code => ({
    eligible: false,
    code,
    mode: 'dry_run',
    chargeRequested: false,
    providerCallMade: false,
    planChangeRequested: false
  });

  if (simulationEnabled !== true) return reject('SIMULATION_DISABLED');
  if (!subscription || typeof subscription !== 'object') {
    throw new TypeError('Abonnement de simulation manquant.');
  }
  if (subscription.statut !== 'active') return reject('SUBSCRIPTION_NOT_ACTIVE');
  if (![true, 1].includes(subscription.auto_renew_enabled)) return reject('AUTO_RENEW_DISABLED');
  if (![true, 1].includes(subscription.consent_active)) return reject('CONSENT_NOT_ACTIVE');
  if (subscription.mandate_status !== 'simulation_authorized') return reject('SIMULATED_MANDATE_REQUIRED');

  const dueAt = parseInstant(subscription.next_renewal_at, 'Prochaine échéance');
  const nowInstant = parseInstant(now, 'Instant de simulation');
  if (dueAt.getTime() > nowInstant.getTime()) return reject('NOT_DUE');

  const amount = Number(subscription.amount);
  if (!Number.isFinite(amount) || amount <= 0) return reject('INVALID_AMOUNT');
  const currency = typeof subscription.currency === 'string' ? subscription.currency.toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(currency)) return reject('INVALID_CURRENCY');

  const subscriptionId = String(subscription.id || '');
  const periodStart = subscription.next_period_start;
  const idempotencyKey = buildPeriodIdempotencyKey(subscriptionId, periodStart);

  return {
    eligible: true,
    code: 'DRY_RUN_READY',
    mode: 'dry_run',
    chargeRequested: false,
    providerCallMade: false,
    planChangeRequested: false,
    subscriptionId,
    amount,
    currency,
    dueAt: dueAt.toISOString(),
    periodStart,
    idempotencyKey
  };
}

module.exports = {
  nextMonthlyPeriod,
  buildPeriodIdempotencyKey,
  evaluateRenewalSimulation
};
