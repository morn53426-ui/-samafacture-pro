/**
 * Helpers de calcul du package SUNUPILOT — extraction depuis `routes/factures.js`.
 *
 * Fonctions pures : aucune connexion BDD, aucun req/res — utiles aux tests.
 * Values en BigInt pour les montants : précision exacte en centimes, pas de
 * float dans les calculs financiers.
 */

const MAX_MONEY_CENTS = 99999999999999n;

/** Texte optionnel tronqué (return null si vide). */
function optionalText(value, maxLength) {
  if (value === undefined || value === null) return null;
  return String(value).trim().slice(0, maxLength) || null;
}

/** Date ISO stricte (aaaa-mm-jj) ou undefined si invalide. */
function optionalIsoDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const date = new Date(text + 'T00:00:00.000Z');
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? undefined : text;
}

/**
 * Parse/valide un nombre décimal saisi (string ou number) vers une valeur
 * précisée en "scaled" BigInt (puissance de 10 selon `scale`).
 * Lance Error si invalide, dépasse maxScaled ou n'est pas un nombre positif.
 */
function parseDecimalInput(value, { field, scale, optional = false, maxScaled }) {
  if ((value === undefined || value === null || value === '') && optional) {
    return { value: 0, scaled: 0n };
  }
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new Error(`${field} doit être un nombre positif valide.`);
  }

  const raw = String(value).trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(raw);
  if (!match) throw new Error(`${field} doit être un nombre décimal positif valide.`);
  const decimals = match[2] || '';
  if (decimals.length > scale) {
    throw new Error(`${field} accepte au maximum ${scale} décimale(s).`);
  }
  const factor = 10n ** BigInt(scale);
  const scaled = BigInt(match[1]) * factor + BigInt(decimals.padEnd(scale, '0') || '0');
  if (scaled > maxScaled) throw new Error(`${field} dépasse la limite autorisée.`);
  return { value: Number(scaled) / Number(factor), scaled };
}

/** Arrondi BigInt : num/den au demi supérieur. */
function roundBigIntDivision(numerator, denominator) {
  if (denominator <= 0n) return 0n;
  return (numerator + denominator / 2n) / denominator;
}

/** Convertit des centimes en montant (float, 2 décimales max). */
function centsToAmount(cents, field = 'Montant') {
  if (cents < 0n || cents > MAX_MONEY_CENTS) {
    throw new Error(`${field} dépasse la limite de précision autorisée.`);
  }
  return Number(cents) / 100;
}

/** Remise absente → 0, null/undefined/'' → 0. */
function remiseInputValue(value) {
  return value === undefined || value === null || value === '' ? 0 : value;
}

/**
 * Calcule la facture en centimes entiers. Les entrées ont déjà été validées à l'API.
 * Remise répartie proportionnellement aux lignes au centime près ; TVA arrondie
 * une seule fois au document.
 */
function computeTotals(lignes, remise, frais_livraison) {
  const quantityScale = 100n; // facture_lignes.quantite est stockée en DECIMAL(14,2)
  const taxScale = 10000n; // taux exprimé en centièmes de pourcentage
  const brutLignes = lignes.map((ligne) => {
    const quantite = parseDecimalInput(ligne.quantite, {
      field: 'Quantité', scale: 2, maxScaled: 99999999999999n
    });
    if (quantite.scaled <= 0n) throw new Error('La quantité doit être supérieure à zéro.');
    const prix = parseDecimalInput(ligne.prix_unitaire, {
      field: 'Prix unitaire', scale: 2, maxScaled: MAX_MONEY_CENTS
    });
    const tva = parseDecimalInput(ligne.tva, {
      field: 'TVA', scale: 2, optional: true, maxScaled: 10000n
    });
    const ligneHTCents = roundBigIntDivision(quantite.scaled * prix.scaled, quantityScale);
    if (ligneHTCents > MAX_MONEY_CENTS) throw new Error('Le montant de cette ligne dépasse la limite autorisée.');
    return {
      ...ligne,
      quantite: quantite.value,
      prix_unitaire: prix.value,
      tva: tva.value,
      ligneHTCents,
      tvaHundredths: tva.scaled
    };
  });

  const sousTotalCents = brutLignes.reduce((sum, ligne) => sum + ligne.ligneHTCents, 0n);
  if (sousTotalCents > MAX_MONEY_CENTS) throw new Error('Le sous-total dépasse la limite autorisée.');
  const frais = parseDecimalInput(frais_livraison, {
    field: 'Frais de livraison', scale: 2, optional: true, maxScaled: MAX_MONEY_CENTS
  });
  const remiseValidee = parseDecimalInput(remiseInputValue(remise), {
    field: 'Remise', scale: 2, optional: true, maxScaled: MAX_MONEY_CENTS
  });
  const remiseCents = remiseValidee.scaled > sousTotalCents ? sousTotalCents : remiseValidee.scaled;

  // Répartition de la remise au centime près (voir commentaire détaillé dans routes/factures.js).
  const allocationsRemise = brutLignes.map((ligne, index) => {
    const numerateur = remiseCents * ligne.ligneHTCents;
    return {
      index,
      part: sousTotalCents > 0n ? numerateur / sousTotalCents : 0n,
      reste: sousTotalCents > 0n ? numerateur % sousTotalCents : 0n
    };
  });
  let centimesRestants = remiseCents -
    allocationsRemise.reduce((sum, allocation) => sum + allocation.part, 0n);
  const ordreAllocation = [...allocationsRemise]
    .filter(allocation => allocation.part < brutLignes[allocation.index].ligneHTCents)
    .sort((a, b) => {
      if (a.reste === b.reste) return a.index - b.index;
      return a.reste > b.reste ? -1 : 1;
    });
  for (const allocation of ordreAllocation) {
    if (centimesRestants <= 0n) break;
    allocation.part += 1n;
    centimesRestants -= 1n;
  }
  if (centimesRestants !== 0n) {
    throw new Error('Impossible de répartir la remise au centime près.');
  }

  const lignesAvecRemise = brutLignes.map((ligne, index) => ({
    ...ligne,
    ligneHTNetteCents: ligne.ligneHTCents - allocationsRemise[index].part
  }));

  // TVA arrondie une seule fois au niveau du document.
  let totalTVANumerateur = 0n;
  const computedLignes = lignesAvecRemise.map((ligne) => {
    totalTVANumerateur += ligne.ligneHTNetteCents * ligne.tvaHundredths;
    const totalLigneTVACents = roundBigIntDivision(
      ligne.ligneHTCents * ligne.tvaHundredths,
      taxScale
    );
    const {
      ligneHTCents, tvaHundredths, ligneHTNetteCents, ...lignePublique
    } = ligne;
    return {
      ...lignePublique,
      total_ligne: centsToAmount(ligneHTCents + totalLigneTVACents, 'Total de ligne')
    };
  });

  const totalTVACents = roundBigIntDivision(totalTVANumerateur, taxScale);
  const totalCents = sousTotalCents - remiseCents + totalTVACents + frais.scaled;
  return {
    computedLignes,
    sous_total: centsToAmount(sousTotalCents, 'Sous-total'),
    total_tva: centsToAmount(totalTVACents, 'TVA'),
    total: centsToAmount(totalCents, 'Total'),
    remise: centsToAmount(remiseCents, 'Remise appliquée'),
    frais_livraison: frais.value
  };
}

module.exports = {
  MAX_MONEY_CENTS,
  optionalText,
  optionalIsoDate,
  parseDecimalInput,
  roundBigIntDivision,
  centsToAmount,
  computeTotals,
  remiseInputValue
};
