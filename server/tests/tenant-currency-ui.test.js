const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const publicDir = path.join(__dirname, '..', '..', 'public');

for (const page of ['produits.html', 'nouvelle-facture.html']) {
  test(page + ' : le JavaScript intégré est syntaxiquement valide', () => {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
    const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
      .map(match => match[1])
      .filter(source => source.trim().length > 0);

    assert.ok(inlineScripts.length > 0, 'la page doit contenir son script applicatif');
    inlineScripts.forEach((source, index) => {
      assert.doesNotThrow(
        () => new vm.Script(source, { filename: page + '#inline-' + index }),
        'le script inline doit pouvoir être analysé'
      );
    });
  });

  test(page + ' : la devise vient du contexte entreprise actif', () => {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
    assert.match(html, /Api\.get\(['"]\/pro\/company-context['"]\)/);
    assert.match(html, /context\?\.devise/);
    if (page === 'nouvelle-facture.html') {
      assert.match(html, /context\?\.fuseau_horaire/);
      assert.match(html, /dateCivileAujourdhui\(context\.fuseau_horaire\)/);
    }
  });
}
