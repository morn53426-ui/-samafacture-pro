'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  nextMonthlyPeriod,
  buildPeriodIdempotencyKey,
  evaluateRenewalSimulation
} = require('../services/subscription-simulator');

test('une ancre au 31 revient au 31 après le mois de février', () => {
  const february = nextMonthlyPeriod('2028-01-31', 31);
  assert.equal(february.periodEnd, '2028-02-29');
  const march = nextMonthlyPeriod(february.periodEnd, february.anchorDay);
  assert.equal(march.periodStart, '2028-02-29');
  assert.equal(march.periodEnd, '2028-03-31');
});

test('les ancres au 30 et au 29 restent stables après un mois court', () => {
  assert.equal(nextMonthlyPeriod('2027-01-30', 30).periodEnd, '2027-02-28');
  assert.equal(nextMonthlyPeriod('2027-02-28', 30).periodEnd, '2027-03-30');
  assert.equal(nextMonthlyPeriod('2027-01-29', 29).periodEnd, '2027-02-28');
  assert.equal(nextMonthlyPeriod('2028-02-29', 29).periodEnd, '2028-03-29');
});

test('la période mensuelle gère le changement d’année et le dernier jour du mois', () => {
  assert.equal(nextMonthlyPeriod('2026-12-31', 31).periodEnd, '2027-01-31');
  assert.equal(nextMonthlyPeriod('2027-03-31', 31).periodEnd, '2027-04-30');
  assert.equal(nextMonthlyPeriod('2027-04-30', 31).periodEnd, '2027-05-31');
});

test('les dates civiles et les jours d’ancrage invalides sont rejetés', () => {
  assert.throws(() => nextMonthlyPeriod('2027-02-29', 31), /Date civile inexistante/);
  assert.throws(() => nextMonthlyPeriod('2027-13-01', 1), /Date civile hors plage/);
  assert.throws(() => nextMonthlyPeriod('2027-01-01', 0), /jour d’ancrage/);
  assert.throws(() => nextMonthlyPeriod('2027-01-01', 32), /jour d’ancrage/);
  assert.throws(() => nextMonthlyPeriod('01/01/2027', 1), /YYYY-MM-DD/);
});

test('la clé d’idempotence est stable, déterministe et différente par période', () => {
  const first = buildPeriodIdempotencyKey(42, '2027-01-31');
  assert.equal(first, buildPeriodIdempotencyKey('42', '2027-01-31'));
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, buildPeriodIdempotencyKey(42, '2027-02-28'));
  assert.notEqual(first, buildPeriodIdempotencyKey(43, '2027-01-31'));
  assert.throws(() => buildPeriodIdempotencyKey(0, '2027-01-31'), /Identifiant/);
});

function readySimulationSubscription(overrides = {}) {
  return {
    id: 42,
    statut: 'active',
    auto_renew_enabled: 1,
    consent_active: 1,
    mandate_status: 'simulation_authorized',
    next_renewal_at: '2027-01-31T08:00:00Z',
    next_period_start: '2027-01-31',
    amount: 5000,
    currency: 'XOF',
    ...overrides
  };
}

test('un renouvellement dû est évalué en dry-run sans débit, appel fournisseur ni changement de plan', () => {
  const result = evaluateRenewalSimulation({
    subscription: readySimulationSubscription(),
    now: '2027-01-31T09:00:00Z',
    simulationEnabled: true
  });

  assert.equal(result.eligible, true);
  assert.equal(result.code, 'DRY_RUN_READY');
  assert.equal(result.mode, 'dry_run');
  assert.equal(result.chargeRequested, false);
  assert.equal(result.providerCallMade, false);
  assert.equal(result.planChangeRequested, false);
  assert.equal(result.amount, 5000);
  assert.equal(result.currency, 'XOF');
  assert.equal(result.idempotencyKey, buildPeriodIdempotencyKey(42, '2027-01-31'));
});

test('la simulation reste bloquée si le drapeau local n’est pas explicitement activé', () => {
  const result = evaluateRenewalSimulation({
    subscription: readySimulationSubscription(),
    now: '2027-02-01T00:00:00Z',
    simulationEnabled: false
  });
  assert.equal(result.eligible, false);
  assert.equal(result.code, 'SIMULATION_DISABLED');
  assert.equal(result.chargeRequested, false);
});

test('un abonnement gratuit/inactif, un renouvellement désactivé ou un consentement absent sont bloqués', () => {
  const base = readySimulationSubscription();
  const cases = [
    [{ statut: 'cancelled' }, 'SUBSCRIPTION_NOT_ACTIVE'],
    [{ auto_renew_enabled: 0 }, 'AUTO_RENEW_DISABLED'],
    [{ consent_active: 0 }, 'CONSENT_NOT_ACTIVE']
  ];

  for (const [override, expectedCode] of cases) {
    const result = evaluateRenewalSimulation({
      subscription: { ...base, ...override },
      now: '2027-02-01T00:00:00Z',
      simulationEnabled: true
    });
    assert.equal(result.eligible, false);
    assert.equal(result.code, expectedCode);
    assert.equal(result.chargeRequested, false);
  }
});

test('un vrai mandat fournisseur ne peut pas être utilisé par le simulateur local', () => {
  const result = evaluateRenewalSimulation({
    subscription: readySimulationSubscription({ mandate_status: 'authorized' }),
    now: '2027-02-01T00:00:00Z',
    simulationEnabled: true
  });
  assert.equal(result.eligible, false);
  assert.equal(result.code, 'SIMULATED_MANDATE_REQUIRED');
  assert.equal(result.providerCallMade, false);
});

test('une échéance future ne déclenche pas de simulation', () => {
  const result = evaluateRenewalSimulation({
    subscription: readySimulationSubscription(),
    now: '2027-01-30T23:59:59Z',
    simulationEnabled: true
  });
  assert.equal(result.eligible, false);
  assert.equal(result.code, 'NOT_DUE');
});

test('le montant et la devise doivent être valides avant la simulation', () => {
  for (const [override, code] of [
    [{ amount: 0 }, 'INVALID_AMOUNT'],
    [{ amount: -1 }, 'INVALID_AMOUNT'],
    [{ amount: 'NaN' }, 'INVALID_AMOUNT'],
    [{ currency: 'FCFA' }, 'INVALID_CURRENCY'],
    [{ currency: 'X1F' }, 'INVALID_CURRENCY']
  ]) {
    const result = evaluateRenewalSimulation({
      subscription: readySimulationSubscription(override),
      now: '2027-02-01T00:00:00Z',
      simulationEnabled: true
    });
    assert.equal(result.eligible, false);
    assert.equal(result.code, code);
  }
});

test('les instants sans fuseau et les dates impossibles sont rejetés', () => {
  assert.throws(() => evaluateRenewalSimulation({
    subscription: readySimulationSubscription({ next_renewal_at: '2027-01-31 08:00:00' }),
    now: '2027-02-01T00:00:00Z',
    simulationEnabled: true
  }), /fuseau explicite/);

  assert.throws(() => evaluateRenewalSimulation({
    subscription: readySimulationSubscription({ next_renewal_at: '2027-02-31T08:00:00Z' }),
    now: '2027-03-01T00:00:00Z',
    simulationEnabled: true
  }), /Date civile inexistante/);
});
