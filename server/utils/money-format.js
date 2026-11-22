'use strict';

const { SUPPORTED_CURRENCIES } = require('../config/localization');

function normalizeCurrency(currency) {
  const normalized = String(currency || 'FCFA').trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(normalized) ? normalized : 'FCFA';
}

function roundMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  const rounded = Math.round((amount + Math.sign(amount) * Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function formatAmountWithCurrency(amount, currency) {
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(roundMoney(amount));
  return formatted + ' ' + normalizeCurrency(currency);
}

module.exports = { formatAmountWithCurrency, roundMoney, normalizeCurrency };
