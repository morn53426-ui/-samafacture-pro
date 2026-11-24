const { isUuid } = require('./utils/uuid');

const TERMINAL_STATUSES = new Set(['completed', 'failed']);

function parseJob(entry) {
  try {
    const job = JSON.parse(entry && entry.message && entry.message.job || '');
    if (!job || typeof job !== 'object') return null;
    if (!isUuid(job.id)) return null;
    if (!Number.isSafeInteger(Number(job.factureId)) || Number(job.factureId) <= 0) return null;
    if (!job.user || job.user.id === undefined || job.user.id === null) return null;
    return job;
  } catch {
    return null;
  }
}

async function terminalAndAcknowledge(redis, key, entryId, jobTtl, acknowledge) {
  await redis.expire(key, jobTtl);
  await acknowledge(entryId);
}

async function processPdfQueueEntry({
  entry,
  redis,
  acknowledge,
  renderPdf,
  savePdf,
  jobPrefix,
  jobTtl,
  maxAttempts = 3
}) {
  const job = parseJob(entry);
  if (!job) {
    // Acknowledge poison messages to avoid an infinite retry loop, but retain an
    // operational trace without logging the payload or any customer data.
    console.error('Tâche PDF invalide acquittée sans exécution (entrée Redis) :', entry && entry.id || 'inconnue');
    await acknowledge(entry.id);
    return 'invalid';
  }

  const key = jobPrefix + job.id;
  const current = await redis.hGetAll(key);

  // The terminal status is written before XACK. If the process died after storing
  // the result but before acknowledging, redelivery only completes the acknowledgement.
  if (TERMINAL_STATUSES.has(current.status)) {
    await terminalAndAcknowledge(redis, key, entry.id, jobTtl, acknowledge);
    return current.status;
  }

  if (!current.id) {
    await redis.hSet(key, {
      id: job.id,
      userId: String(job.user.id),
      factureId: String(job.factureId),
      createdAt: job.createdAt || new Date().toISOString()
    });
  }

  const attempts = Number(await redis.hIncrBy(key, 'attempts', 1));
  await redis.hSet(key, {
    status: 'processing',
    startedAt: new Date().toISOString()
  });

  let pdf;
  let file;
  try {
    pdf = await renderPdf(job.factureId, job.user);
    file = await savePdf(job.id, pdf);
  } catch (err) {
    console.error('PDF job ' + job.id + ' échoué (tentative ' + attempts + '/' + maxAttempts + ') :', err.message);
    if (attempts >= maxAttempts) {
      await redis.hSet(key, {
        status: 'failed',
        error: 'La génération du PDF a échoué après plusieurs tentatives.',
        failedAt: new Date().toISOString()
      });
      await terminalAndAcknowledge(redis, key, entry.id, jobTtl, acknowledge);
      return 'failed';
    }

    // Do not acknowledge transient failures. The entry stays in the PEL and is
    // eligible for XAUTOCLAIM after the configured visibility timeout.
    await redis.hSet(key, {
      status: 'queued',
      lastError: 'La génération du PDF doit être retentée.',
      lastAttemptAt: new Date().toISOString()
    });
    return 'retrying';
  }

  await redis.hSet(key, {
    status: 'completed',
    file,
    completedAt: new Date().toISOString(),
    size: String(pdf.length)
  });
  await terminalAndAcknowledge(redis, key, entry.id, jobTtl, acknowledge);
  return 'completed';
}

module.exports = { processPdfQueueEntry };
