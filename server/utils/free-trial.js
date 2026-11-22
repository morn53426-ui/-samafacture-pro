'use strict';

const TRIAL_DAYS = 15;
const TRIAL_DURATION_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
const TRIAL_PLANS = Object.freeze(['starter', 'pro', 'entreprise']);

/**
 * "Standard" est le nom commercial du palier "starter" déjà utilisé dans
 * la base et les contrôles d'accès. On conserve la valeur canonique existante.
 */
function normalizeTrialPlan(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  const canonical = normalized === 'standard' ? 'starter' : normalized;
  return TRIAL_PLANS.includes(canonical) ? canonical : null;
}

function toEpoch(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value !== 'string' || !value.trim()) return NaN;
  const text = value.trim();
  // MySQL DATETIME values written by this feature are UTC and have no suffix.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(text)
    ? text.replace(' ', 'T') + 'Z'
    : text;
  const epoch = Date.parse(normalized);
  return Number.isFinite(epoch) ? epoch : NaN;
}

function isTrialActive(trial, now = new Date()) {
  if (!trial || trial.trial_status !== 'trialing') return false;
  const end = toEpoch(trial.trial_ends_at);
  const instant = toEpoch(now);
  return Number.isFinite(end) && Number.isFinite(instant) && end > instant;
}

module.exports = { TRIAL_DAYS, TRIAL_DURATION_MS, TRIAL_PLANS, normalizeTrialPlan, isTrialActive };
