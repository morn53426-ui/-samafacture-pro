/**
 * Routes PDF des factures/devis (voir refactorisation : routes/factures/).
 * Extrait depuis routes/factures.js — POST /:id/pdf/async, GET /:id/pdf/jobs/:jobId,
 * GET /:id/pdf/jobs/:jobId/download, GET /:id/pdf.
 */
const express = require('express');
const { pool } = require('../../config/db');
const { genererPdfFacture } = require('../../utils/pdf');
const { enqueuePdfJob, getPdfJob, getPdfPath } = require('../../pdf-queue');

const router = express.Router();

router.post('/:id/pdf/async', async (req, res, next) => {
  try {
    if (!process.env.REDIS_URL) return res.status(503).json({ error: "La génération PDF asynchrone n'est pas configurée." });
    const [rows] = await pool.query('SELECT id FROM factures WHERE id = ? AND user_id = ?', [req.params.id, req.tenantId]);
    if (!rows.length) return res.status(404).json({ error: 'Document introuvable.' });
    const jobId = await enqueuePdfJob({ factureId: req.params.id, user: { ...req.user, id: req.tenantId } });
    res.status(202).json({ job_id: jobId, status: 'queued' });
  } catch (err) { next(err); }
});

router.get('/:id/pdf/jobs/:jobId', async (req, res, next) => {
  try {
    const job = await getPdfJob(req.params.jobId, req.tenantId);
    if (!job) return res.status(404).json({ error: 'Job PDF introuvable.' });
    if (String(job.factureId) !== String(req.params.id)) return res.status(404).json({ error: 'Job PDF introuvable.' });
    if (job.status === 'completed') {
      return res.json({ status: job.status, download_url: `/api/factures/${req.params.id}/pdf/jobs/${req.params.jobId}/download` });
    }
    res.json({ status: job.status, error: job.error || null });
  } catch (err) { next(err); }
});

router.get('/:id/pdf/jobs/:jobId/download', async (req, res, next) => {
  try {
    const job = await getPdfJob(req.params.jobId, req.tenantId);
    if (!job || String(job.factureId) !== String(req.params.id) || job.status !== 'completed') {
      return res.status(404).json({ error: 'PDF non disponible.' });
    }
    const file = await getPdfPath(req.params.jobId);
    const [rows] = await pool.query('SELECT numero, type FROM factures WHERE id = ? AND user_id = ?', [req.params.id, req.tenantId]);
    if (!rows.length) return res.status(404).json({ error: 'Document introuvable.' });
    const prefixe = rows[0].type === 'devis' ? 'devis' : 'facture';
    res.download(file, `${prefixe}-${rows[0].numero}.pdf`, err => { if (err && !res.headersSent) next(err); });
  } catch (err) { next(err); }
});

router.get('/:id/pdf', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, numero, type FROM factures WHERE id = ? AND user_id = ?', [req.params.id, req.tenantId]);
    const facture = rows[0];
    if (!facture) return res.status(404).json({ error: 'Document introuvable.' });

    const pdfBuffer = await genererPdfFacture(facture.id, { ...req.user, id: req.tenantId });
    const prefixe = facture.type === 'devis' ? 'devis' : 'facture';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${prefixe}-${facture.numero}.pdf"`,
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Génération PDF échouée :', err.message);
    res.status(502).json({ error: "Impossible de générer le PDF pour le moment. Réessayez dans un instant." });
  }
});

module.exports = router;
