const nodemailer = require('nodemailer');

function isSmtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

let transporter = null;
function getTransporter() {
  if (!isSmtpConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    });
  }
  return transporter;
}

/**
 * Envoie un email si le SMTP est configuré (.env). En son absence, ne journalise jamais
 * le destinataire, l'objet, le corps, les liens ni les jetons, qui peuvent contenir des
 * données personnelles ou des secrets de réinitialisation/consultation.
 */
async function sendMail({ to, subject, html, text, attachments }) {
  const t = getTransporter();
  if (!t) {
    console.warn('SMTP non configuré : email non envoyé. Aucun contenu ni lien sensible n’a été journalisé.');
    return { sent: false, reason: 'smtp_not_configured' };
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to, subject, html, text, attachments
  });
  return { sent: true };
}

module.exports = { sendMail, isSmtpConfigured };
