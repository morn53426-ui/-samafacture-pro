// Formatage des montants dans les emails, messages WhatsApp et erreurs d'API.
// Remplace les "FCFA" codés en dur : une facture en EUR ou USD doit être annoncée
// dans sa propre devise, avec ses décimales, et sans artefact de virgule flottante.
const ZERO_DECIMAL_CURRENCIES = new Set(['FCFA', 'XOF', 'XAF', 'BIF', 'CDF', 'DJF', 'KMF', 'GNF', 'RWF', 'UGX', 'JPY']);

function normalizeCurrency(devise) {
  const code = String(devise || 'FCFA').trim().toUpperCase();
  return code || 'FCFA';
}

function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatAmountWithCurrency(amount, devise) {
  const code = normalizeCurrency(devise);
  const decimals = ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2;
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(roundMoney(amount));
  // Les espaces fines insécables de fr-FR s'affichent mal dans certains clients email texte.
  return `${formatted.replace(/[\\u202F\\u00A0]/g, ' ')} ${code}`;
}

module.exports = { formatAmountWithCurrency, roundMoney, normalizeCurrency };
