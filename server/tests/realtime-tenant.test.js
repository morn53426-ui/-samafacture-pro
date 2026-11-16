const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { resolveSocketTenant } = require('../realtime');

describe('Reconnexion des notifications lors du changement d’entreprise', () => {
  test('la page Professionnel déclenche un changement de salle et le sidebar recrée le socket', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const sidebar = fs.readFileSync(path.resolve(__dirname, '../../public/js/sidebar.js'), 'utf8');
    const professional = fs.readFileSync(path.resolve(__dirname, '../../public/professionnel.html'), 'utf8');
    assert.match(professional, /dispatchEvent\(new Event\('sf-company-changed'\)\)/);
    assert.match(sidebar, /addEventListener\('sf-company-changed', connecterNotifications\)/);
    assert.match(sidebar, /if \(socket\) socket\.disconnect\(\)/);
  });
});

describe('Sélection d’entreprise Socket.IO', () => {
  test('un propriétaire rejoint son propre espace sans requête SQL', async () => {
    let called = false;
    const tenant = await resolveSocketTenant(12, '12', async () => { called = true; return [[]]; });
    assert.equal(tenant, 12); assert.equal(called, false);
  });

  test('un membre rejoint uniquement une entreprise avec adhésion active', async () => {
    const calls = [];
    const tenant = await resolveSocketTenant(25, '12', async (sql, params) => { calls.push({ sql, params }); return [[{ owner_user_id: 12 }]]; });
    assert.equal(tenant, 12); assert.deepEqual(calls[0].params, [25, 12]); assert.match(calls[0].sql, /active = 1/);
  });

  test('un propriétaire de groupe rejoint une filiale après acceptation si le plan Entreprise est actif', async () => {
    const calls = [];
    const tenant = await resolveSocketTenant(12, '34', async (sql, params) => {
      calls.push({ sql, params });
      return calls.length === 1
        ? [[]]
        : [[{ owner_user_id: 34, group_plan: 'entreprise' }]];
    });

    assert.equal(tenant, 34);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].params, [12, 34]);
    assert.match(calls[1].sql, /pro_company_group_companies/);
    assert.match(calls[1].sql, /g\.owner_user_id = \?/);
  });

  test('un groupe sans plan Entreprise actif ne donne pas accès à une filiale', async () => {
    let call = 0;
    await assert.rejects(
      resolveSocketTenant(12, '34', async () => {
        call += 1;
        return call === 1 ? [[]] : [[{ owner_user_id: 34, group_plan: 'pro' }]];
      }),
      /Adhésion à cette entreprise absente ou inactive/
    );
  });

  test('une filiale ne peut pas rejoindre le tenant de son groupe', async () => {
    await assert.rejects(
      resolveSocketTenant(34, '12', async () => [[]]),
      /Adhésion à cette entreprise absente ou inactive/
    );
  });

  test('une sélection falsifiée ou une adhésion inactive est refusée', async () => {
    await assert.rejects(resolveSocketTenant(25, 'not-an-id', async () => [[]]), /Sélection d’entreprise invalide/);
    await assert.rejects(resolveSocketTenant(25, '99', async () => [[]]), /Adhésion à cette entreprise absente ou inactive/);
  });
});
