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
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    });
  }
  return transporter;
}

/**
 * Envoie un email si le SMTP est configuré (.env). Sinon, affiche le contenu dans la
 * console du serveur — utile pour tester la réinitialisation de mot de passe en local
 * sans avoir à configurer un vrai service d'email.
 */
async function sendMail({ to, subject, html, text, attachments }) {
  const t = getTransporter();
  if (!t) {
    console.log('\n📧 SMTP non configuré — email non envoyé, contenu affiché ci-dessous :');
    console.log(`   À : ${to}`);
    console.log(`   Sujet : ${subject}`);
    console.log(`   ${text || html}`);
    if (attachments?.length) console.log(`   Pièce(s) jointe(s) : ${attachments.map(a => a.filename).join(', ')}`);
    console.log('');
    return { sent: false };
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to, subject, html, text, attachments
  });
  return { sent: true };
}

module.exports = { sendMail, isSmtpConfigured };
