const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const ALLOWED_LOCALES = new Set(['fr-FR', 'fr-CA', 'en-US', 'en-GB', 'es-ES', 'pt-PT', 'ar-MA']);

function validTimezone(value) {
  if (typeof value !== 'string' || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch (_) {
    return false;
  }
}

router.get('/', async (req, res, next) => {
  try {
    const [[user]] = await pool.query(
      'SELECT locale, timezone, devise FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'Compte introuvable.' });
    res.json({
      locale: user.locale || 'fr-FR',
      timezone: user.timezone || 'Africa/Dakar',
      devise: user.devise || 'FCFA',
      currency_note: 'La devise définit l’unité d’affichage choisie. Aucune conversion de change automatique n’est effectuée.'
    });
  } catch (err) { next(err); }
});

router.put('/', async (req, res, next) => {
  try {
    const locale = String(req.body?.locale || '');
    const timezone = String(req.body?.timezone || '');
    if (!ALLOWED_LOCALES.has(locale)) {
      return res.status(400).json({ error: 'Langue/format régional non pris en charge.' });
    }
    if (!validTimezone(timezone)) {
      return res.status(400).json({ error: 'Fuseau horaire IANA invalide.' });
    }
    await pool.query(
      'UPDATE users SET locale = ?, timezone = ? WHERE id = ?',
      [locale, timezone, req.user.id]
    );
    const [[user]] = await pool.query(
      'SELECT locale, timezone, devise FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ success: true, preferences: user });
  } catch (err) { next(err); }
});

module.exports = router;
