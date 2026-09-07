// Définitions centralisées des plans et de ce qu'ils débloquent, pour que la même règle
// s'applique partout (impossible de contourner une limite en appelant l'API directement).

const FREE_MONTHLY_INVOICE_LIMIT = 10;

// Modèles de facture réservés au plan Pro (et Entreprise) — les autres sont disponibles
// pour tous les plans, y compris Gratuit.
const PRO_TEMPLATES = ['elegant', 'corporate', 'creatif'];

// Modèles réservés exclusivement au plan Entreprise (Pro n'y a pas accès, contrairement à
// PRO_TEMPLATES ci-dessus qui est partagé par Pro et Entreprise) — avantage propre au plan
// le plus élevé plutôt qu'un simple palier supplémentaire du plan Pro.
const ENTERPRISE_TEMPLATES = ['prestige', 'heritage', 'diamant', 'platine'];

/** Un plan payant quel qu'il soit (débloque les factures illimitées). */
function isPaidPlan(plan) {
  return plan === 'starter' || plan === 'pro' || plan === 'entreprise';
}

/** Plan Pro ou Entreprise uniquement (débloque signature électronique, modèles premium, export Excel...). */
function isProPlan(plan) {
  return plan === 'pro' || plan === 'entreprise';
}

/** Plan Entreprise uniquement (débloque les modèles de facture exclusifs Entreprise). */
function isEnterprisePlan(plan) {
  return plan === 'entreprise';
}

module.exports = { FREE_MONTHLY_INVOICE_LIMIT, PRO_TEMPLATES, ENTERPRISE_TEMPLATES, isPaidPlan, isProPlan, isEnterprisePlan };
