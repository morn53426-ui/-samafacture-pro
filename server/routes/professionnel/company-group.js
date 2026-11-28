const crypto = require('crypto');
const { decryptEmailPayload, encryptEmailPayload } = require('../../utils/email-outbox-crypto');
const { isEnterprisePlan } = require('../../utils/plans');
const { localDateString } = require('../../utils/local-date');
const { pool } = require('../../config/db');
const {
  actor,
  assertEnterpriseGroupOwner,
  audit,
  companyGroupPaginationMeta,
  idOk,
  owner,
  parseCompanyGroupPagination
} = require('./shared');

module.exports = function registerCompanyGroupRoutes(router) {
/* ---------------------- GROUPE MULTI-SOCIÉTÉS (ENTREPRISE) ------------- */

router.get('/company-group/membership', async (req, res, next) => {
  try {
    const [[membership]] = await pool.query(
      `SELECT g.id AS group_id, g.nom AS group_name, g.owner_user_id,
              owner.entreprise_nom AS group_owner_company,
              owner.plan AS group_plan,
              gc.is_primary
       FROM pro_company_group_companies gc
       JOIN pro_company_groups g ON g.id = gc.group_id
       JOIN users owner ON owner.id = g.owner_user_id
       WHERE gc.company_owner_id = ?
       LIMIT 1`,
      [actor(req)]
    );
    if (!membership) return res.json({ membre: false });
    res.json({
      membre: true,
      groupe: {
        id: Number(membership.group_id),
        nom: membership.group_name,
        entreprise_proprietaire: membership.group_owner_company,
        actif: isEnterprisePlan(membership.group_plan)
      },
      societe_principale: Number(membership.is_primary) === 1,
      peut_quitter: Number(membership.is_primary) !== 1
    });
  } catch (err) { next(err); }
});

router.get('/company-group', async (req, res, next) => {
  try {
    if (!await assertEnterpriseGroupOwner(req, res)) return;
    const pagination = parseCompanyGroupPagination(req.query);
    if (pagination?.error) return res.status(400).json({ error: pagination.error });
    const [groups] = await pool.query(
      'SELECT id, owner_user_id, nom, created_at, updated_at FROM pro_company_groups WHERE owner_user_id = ? LIMIT 1',
      [actor(req)]
    );
    if (!groups.length) {
      return res.json({
        groupe: null, societes: [], invitations: [],
        ...(pagination ? { pagination: companyGroupPaginationMeta(0, pagination) } : {})
      });
    }
    const group = groups[0];
    const [[companyCount]] = await pool.query(
      'SELECT COUNT(*) AS total FROM pro_company_group_companies WHERE group_id = ?',
      [group.id]
    );
    const companyTotal = Number(companyCount.total || 0);
    const companySql = `
      SELECT gc.id AS liaison_id, gc.company_owner_id AS id, gc.is_primary, gc.linked_at,
             u.nom AS contact_nom, u.email, u.entreprise_nom, u.entreprise_ninea,
             u.entreprise_rccm, u.pays_code, u.devise
      FROM pro_company_group_companies gc
      JOIN users u ON u.id = gc.company_owner_id
      WHERE gc.group_id = ?
      ORDER BY gc.is_primary DESC, u.entreprise_nom ASC, gc.company_owner_id ASC`;
    const companyParams = [group.id];
    const companyQuery = pagination
      ? companySql + ' LIMIT ? OFFSET ?'
      : companySql;
    if (pagination) companyParams.push(pagination.limit, pagination.offset);
    const [companies] = await pool.query(companyQuery, companyParams);
    const [invitations] = await pool.query(
      `SELECT i.id, i.invited_email, i.statut, i.expire_at, i.created_at,
              e.statut AS email_statut, e.tentatives AS tentatives_email,
              e.envoye_le AS email_envoye_le, e.dernier_code_erreur AS email_code_erreur
       FROM pro_company_group_invitations i
       LEFT JOIN email_outbox e
         ON e.entity_type = 'company_group_invitation' AND e.entity_id = i.id
       WHERE i.group_id = ? AND i.statut = 'envoyee' AND i.expire_at > NOW()
       ORDER BY i.created_at DESC LIMIT 100`,
      [group.id]
    );
    res.json({
      groupe: group,
      societes: companies,
      invitations,
      ...(pagination ? { pagination: companyGroupPaginationMeta(companyTotal, pagination) } : {})
    });
  } catch (err) { next(err); }
});

router.post('/company-group', async (req, res, next) => {
  let conn;
  try {
    if (!await assertEnterpriseGroupOwner(req, res)) return;
    const nom = String(req.body.nom || '').trim().slice(0, 190);
    if (!nom) return res.status(400).json({ error: 'Le nom du groupe est obligatoire.' });
    const [[existing]] = await pool.query(
      'SELECT id FROM pro_company_groups WHERE owner_user_id = ? LIMIT 1',
      [actor(req)]
    );
    if (existing) return res.status(409).json({ error: 'Un groupe de sociétés existe déjà pour ce compte.' });

    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [groupResult] = await conn.query(
      'INSERT INTO pro_company_groups (owner_user_id, nom) VALUES (?, ?)',
      [actor(req), nom]
    );
    await conn.query(
      'INSERT INTO pro_company_group_companies (group_id, company_owner_id, is_primary) VALUES (?, ?, 1)',
      [groupResult.insertId, actor(req)]
    );
    await conn.query(
      'INSERT INTO pro_audit_logs (user_id, acteur_user_id, action, entite, entite_id, details_json, adresse_ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [actor(req), actor(req), 'groupe.societes.cree', 'groupe_societes', String(groupResult.insertId), JSON.stringify({ nom }), req.ip || null]
    );
    await conn.commit();
    res.status(201).json({ id: groupResult.insertId, nom, societe_principale_id: actor(req) });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Un groupe de sociétés existe déjà pour ce compte ou cette société.' });
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.post('/company-group/invitations', async (req, res, next) => {
  let conn;
  try {
    if (!await assertEnterpriseGroupOwner(req, res)) return;
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Adresse email invalide.' });
    }
    if (email === String(req.user.email || '').toLowerCase()) {
      return res.status(400).json({ error: 'La société principale appartient déjà à ce groupe.' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Verrouille la ligne du groupe : toutes les créations d'invitations du même
    // groupe passent ainsi l'une après l'autre, y compris entre plusieurs workers.
    const [[group]] = await conn.query(
      'SELECT id, nom FROM pro_company_groups WHERE owner_user_id = ? LIMIT 1 FOR UPDATE',
      [actor(req)]
    );
    if (!group) {
      await conn.rollback();
      return res.status(409).json({ error: 'Créez d’abord le groupe de sociétés.' });
    }

    const [[recipient]] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (recipient) {
      const [[alreadyLinked]] = await conn.query(
        'SELECT id FROM pro_company_group_companies WHERE company_owner_id = ? LIMIT 1',
        [recipient.id]
      );
      if (alreadyLinked) {
        await conn.rollback();
        return res.status(409).json({ error: 'Ce compte société appartient déjà à un groupe.' });
      }
    }

    const [[pending]] = await conn.query(
      'SELECT id FROM pro_company_group_invitations WHERE group_id = ? AND invited_email = ? AND statut = ? AND expire_at > NOW() LIMIT 1 FOR UPDATE',
      [group.id, email, 'envoyee']
    );
    if (pending) {
      await conn.rollback();
      return res.status(409).json({ error: 'Une invitation active existe déjà pour cette adresse.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expires = new Date(Date.now() + 7 * 86400000);
    const base = (process.env.APP_URL || (req.protocol + '://' + req.get('host'))).replace(/\/$/, '');
    const invitationUrl = base + '/invitation.html?type=company-group&token=' + token;
    const subject = 'Invitation à rejoindre un groupe de sociétés SamaFacture Pro';
    const text = 'Le groupe « ' + group.nom + ' » vous invite à rattacher votre société à son espace de gestion. Acceptez uniquement si vous autorisez explicitement le propriétaire du groupe à accéder à votre société : ' + invitationUrl;

    const [result] = await conn.query(
      'INSERT INTO pro_company_group_invitations (group_id, invited_email, token_hash, expire_at) VALUES (?, ?, ?, ?)',
      [group.id, email, tokenHash, expires]
    );

    // L'invitation et son email chiffré sont enregistrés dans la même transaction :
    // aucun lien/jeton brut ne reste en clair dans la base ou les journaux.
    const payloadEnc = encryptEmailPayload({ to: email, subject, text, invitation_url: invitationUrl });
    const idempotencyKey = crypto.createHash('sha256')
      .update('company-group-invitation:' + result.insertId)
      .digest('hex');
    await conn.query(
      `INSERT INTO email_outbox
       (owner_user_id, entity_type, entity_id, idempotency_key, payload_enc, statut, prochaine_tentative)
       VALUES (?, 'company_group_invitation', ?, ?, ?, 'queued', NOW())`,
      [actor(req), result.insertId, idempotencyKey, payloadEnc]
    );
    await conn.commit();

    await audit(req, 'groupe.societes.invitation_creee', 'invitation_groupe', result.insertId, { email });
    // Le jeton brut n'est retourné qu'au propriétaire et ne doit jamais être mis en cache.
    res.set('Cache-Control', 'no-store, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.status(201).json({
      id: result.insertId,
      email,
      invitation_url: invitationUrl,
      email_envoye: false,
      email_en_file: true,
      email_statut: 'queued',
      avertissement: 'Email placé dans la file d’envoi sécurisée. Il sera envoyé en arrière-plan et réessayé automatiquement en cas d’indisponibilité temporaire du serveur SMTP.',
      expire_le: expires
    });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.get('/company-group/invitations/:invitationId/link', async (req, res, next) => {
  try {
    if (!await assertEnterpriseGroupOwner(req, res)) return;
    if (!idOk(req.params.invitationId)) {
      return res.status(400).json({ error: 'Identifiant d’invitation invalide.' });
    }

    const [[invitation]] = await pool.query(
      `SELECT i.id, i.invited_email, i.token_hash, e.payload_enc
       FROM pro_company_group_invitations i
       JOIN pro_company_groups g ON g.id = i.group_id
       JOIN email_outbox e
         ON e.entity_type = 'company_group_invitation' AND e.entity_id = i.id
       WHERE i.id = ? AND g.owner_user_id = ?
         AND i.statut = 'envoyee' AND i.expire_at > NOW()
       LIMIT 1`,
      [req.params.invitationId, actor(req)]
    );
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation active introuvable ou expirée.' });
    }

    const payload = decryptEmailPayload(invitation.payload_enc);
    if (String(payload.to).toLowerCase() !== String(invitation.invited_email).toLowerCase()) {
      return res.status(409).json({
        error: 'Le lien de cette invitation ne peut pas être récupéré.',
        code: 'LIEN_INVITATION_INDISPONIBLE'
      });
    }
    const fallbackLink = typeof payload.text === 'string'
      ? payload.text.match(/https?:\/\/[^\s]+/)?.[0]
      : null;
    const invitationUrl = String(payload.invitation_url || fallbackLink || '');
    let parsed;
    try { parsed = new URL(invitationUrl); } catch {
      return res.status(409).json({
        error: 'Le lien de cette invitation ne peut pas être récupéré.',
        code: 'LIEN_INVITATION_INDISPONIBLE'
      });
    }
    const token = parsed.searchParams.get('token') || '';
    if (!['http:', 'https:'].includes(parsed.protocol) ||
        parsed.username || parsed.password ||
        parsed.pathname !== '/invitation.html' ||
        parsed.searchParams.get('type') !== 'company-group' ||
        !/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(409).json({
        error: 'Le lien de cette invitation ne peut pas être récupéré.',
        code: 'LIEN_INVITATION_INDISPONIBLE'
      });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest();
    const expectedHash = Buffer.from(invitation.token_hash, 'hex');
    if (expectedHash.length !== tokenHash.length || !crypto.timingSafeEqual(expectedHash, tokenHash)) {
      return res.status(409).json({
        error: 'Le lien de cette invitation ne peut pas être récupéré.',
        code: 'LIEN_INVITATION_INDISPONIBLE'
      });
    }

    await audit(req, 'groupe.societes.lien_invitation_recupere', 'invitation_groupe', invitation.id, {
      email: invitation.invited_email
    });
    // Le lien contient un jeton d'acceptation : désactive explicitement tout cache HTTP.
    res.set('Cache-Control', 'no-store, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({ id: invitation.id, email: invitation.invited_email, invitation_url: invitationUrl });
  } catch (err) { next(err); }
});

router.post('/company-group/invitations/:invitationId/retry-email', async (req, res, next) => {
  let conn;
  try {
    if (!await assertEnterpriseGroupOwner(req, res)) return;
    if (!idOk(req.params.invitationId)) {
      return res.status(400).json({ error: 'Identifiant d’invitation invalide.' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [[group]] = await conn.query(
      'SELECT id FROM pro_company_groups WHERE owner_user_id = ? LIMIT 1 FOR UPDATE',
      [actor(req)]
    );
    if (!group) {
      await conn.rollback();
      return res.status(404).json({ error: 'Groupe de sociétés introuvable.' });
    }

    const [[invitation]] = await conn.query(
      `SELECT i.id, i.invited_email, e.id AS email_id, e.statut AS email_statut
       FROM pro_company_group_invitations i
       JOIN email_outbox e
         ON e.entity_type = 'company_group_invitation' AND e.entity_id = i.id
       WHERE i.id = ? AND i.group_id = ?
         AND i.statut = 'envoyee' AND i.expire_at > NOW()
       LIMIT 1 FOR UPDATE`,
      [req.params.invitationId, group.id]
    );
    if (!invitation) {
      await conn.rollback();
      return res.status(404).json({ error: 'Invitation active introuvable ou expirée.' });
    }
    if (invitation.email_statut !== 'failed') {
      await conn.rollback();
      return res.status(409).json({
        error: 'Seul un email définitivement échoué peut être relancé.',
        code: 'EMAIL_NON_RELANCABLE',
        email_statut: invitation.email_statut
      });
    }

    const [updated] = await conn.query(
      `UPDATE email_outbox
       SET statut = 'queued', tentatives = 0, prochaine_tentative = NOW(),
           verrouille_le = NULL, lock_token = NULL, dernier_code_erreur = NULL,
           updated_at = NOW()
       WHERE id = ? AND owner_user_id = ? AND statut = 'failed'`,
      [invitation.email_id, actor(req)]
    );
    if (updated.affectedRows !== 1) {
      await conn.rollback();
      return res.status(409).json({ error: 'Cet email ne peut plus être relancé.' });
    }
    await conn.commit();
    await audit(req, 'groupe.societes.email_invitation_relance', 'invitation_groupe', invitation.id, {
      email: invitation.invited_email
    });
    res.status(202).json({
      success: true,
      email_statut: 'queued',
      message: 'Email remis dans la file d’envoi sécurisée.'
    });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.post('/company-group/invitations/accept', async (req, res, next) => {
  let conn;
  try {
    if (actor(req) !== owner(req) || req.companyMembership) {
      return res.status(403).json({ error: 'Connectez-vous au compte propriétaire de la société à rattacher.' });
    }
    const token = String(req.body.token || '');
    if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(400).json({ error: 'Jeton d’invitation invalide.' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [[currentAccount]] = await conn.query(
      'SELECT email FROM users WHERE id = ? LIMIT 1 FOR UPDATE',
      [actor(req)]
    );
    if (!currentAccount?.email) {
      await conn.rollback();
      return res.status(403).json({ error: 'Le compte connecté doit disposer d’une adresse email.' });
    }
    const [invites] = await conn.query(
      "SELECT i.id, i.group_id, i.invited_email, i.statut, i.expire_at, g.owner_user_id, g.nom AS group_name, u.plan AS owner_plan\n" +
      "FROM pro_company_group_invitations i JOIN pro_company_groups g ON g.id = i.group_id JOIN users u ON u.id = g.owner_user_id\n" +
      "WHERE i.token_hash = ? AND i.statut = 'envoyee' AND i.expire_at > NOW() LIMIT 1 FOR UPDATE",
      [tokenHash]
    );
    const invite = invites[0];
    if (!invite) {
      await conn.rollback();
      return res.status(404).json({ error: 'Invitation expirée, révoquée ou déjà utilisée.' });
    }
    if (String(invite.invited_email).toLowerCase() !== String(currentAccount.email).toLowerCase()) {
      await conn.rollback();
      return res.status(403).json({ error: 'Connectez-vous avec l’adresse email qui a reçu cette invitation.' });
    }
    if (!isEnterprisePlan(invite.owner_plan)) {
      await conn.rollback();
      return res.status(409).json({ error: 'Le compte propriétaire du groupe n’a plus la formule Entreprise active.' });
    }
    if (Number(invite.owner_user_id) === actor(req)) {
      await conn.rollback();
      return res.status(400).json({ error: 'La société principale ne peut pas être ajoutée une seconde fois.' });
    }
    const [[alreadyLinked]] = await conn.query(
      'SELECT id FROM pro_company_group_companies WHERE company_owner_id = ? LIMIT 1 FOR UPDATE',
      [actor(req)]
    );
    if (alreadyLinked) {
      await conn.rollback();
      return res.status(409).json({ error: 'Cette société est déjà rattachée à un groupe.' });
    }

    const [[existingProof]] = await conn.query(
      "SELECT id, used_at, (expires_at > NOW()) AS is_active, (sent_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)) AS recently_sent " +
      "FROM pro_company_group_invitation_verifications WHERE invitation_id = ? LIMIT 1 FOR UPDATE",
      [invite.id]
    );
    if (existingProof && !existingProof.used_at && Number(existingProof.is_active) === 1 &&
        Number(existingProof.recently_sent) === 1) {
      const [[outbox]] = await conn.query(
        "SELECT statut FROM email_outbox WHERE entity_type = 'company_group_invitation_verification' AND entity_id = ? LIMIT 1",
        [existingProof.id]
      );
      await conn.commit();
      res.set('Cache-Control', 'no-store, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      return res.status(202).json({
        verification_required: true,
        email_en_file: true,
        email_statut: outbox?.statut || 'queued',
        message: 'Un lien de vérification a déjà été demandé récemment. Consultez la boîte de réception de l’adresse invitée avant de demander un nouvel envoi.'
      });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const expires = new Date(Date.now() + 20 * 60 * 1000);
    await conn.query(
      "INSERT INTO pro_company_group_invitation_verifications (invitation_id, company_owner_id, token_hash, expires_at, sent_at, used_at) " +
      "VALUES (?, ?, ?, ?, NOW(), NULL) ON DUPLICATE KEY UPDATE company_owner_id = VALUES(company_owner_id), " +
      "token_hash = VALUES(token_hash), expires_at = VALUES(expires_at), sent_at = NOW(), used_at = NULL",
      [invite.id, actor(req), verificationHash, expires]
    );
    const [[proof]] = await conn.query(
      'SELECT id FROM pro_company_group_invitation_verifications WHERE invitation_id = ? LIMIT 1',
      [invite.id]
    );
    const base = (process.env.APP_URL || (req.protocol + '://' + req.get('host'))).replace(/\/$/, '');
    const verificationUrl = base + '/invitation.html?type=company-group#token=' +
      encodeURIComponent(token) + '&verification_token=' + encodeURIComponent(verificationToken);
    const subject = 'Confirmez votre adresse email pour rejoindre le groupe SamaFacture Pro';
    const text = 'Une demande a été faite pour rattacher votre société au groupe « ' + invite.group_name +
      ' ». Pour confirmer que vous contrôlez cette adresse email et autoriser le rattachement, ouvrez ce lien valable 20 minutes : ' +
      verificationUrl + '\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez ce message. Votre société ne sera pas rattachée sans cette confirmation.';
    const payloadEnc = encryptEmailPayload({
      to: invite.invited_email,
      subject,
      text,
      verification_url: verificationUrl
    });
    const idempotencyKey = crypto.createHash('sha256')
      .update('company-group-invitation-verification:' + proof.id)
      .digest('hex');
    await conn.query(
      "INSERT INTO email_outbox (owner_user_id, entity_type, entity_id, idempotency_key, payload_enc, statut, tentatives, prochaine_tentative) " +
      "VALUES (?, 'company_group_invitation_verification', ?, ?, ?, 'queued', 0, NOW()) " +
      "ON DUPLICATE KEY UPDATE payload_enc = VALUES(payload_enc), statut = 'queued', tentatives = 0, " +
      "prochaine_tentative = NOW(), verrouille_le = NULL, lock_token = NULL, dernier_code_erreur = NULL, envoye_le = NULL, updated_at = NOW()",
      [invite.owner_user_id, proof.id, idempotencyKey, payloadEnc]
    );
    await conn.commit();

    await audit(req, 'groupe.societes.verification_email_demandee', 'invitation_groupe', invite.id, {
      company_owner_id: actor(req)
    });
    res.set('Cache-Control', 'no-store, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return res.status(202).json({
      verification_required: true,
      email_en_file: true,
      email_statut: 'queued',
      message: 'Un lien de confirmation a été placé dans la file d’envoi sécurisée à l’adresse invitée. Le rattachement ne sera effectué qu’après ouverture de ce lien depuis cette boîte email.'
    });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Cette société appartient déjà à un groupe.' });
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.post('/company-group/invitations/accept/verify', async (req, res, next) => {
  let conn;
  try {
    if (actor(req) !== owner(req) || req.companyMembership) {
      return res.status(403).json({ error: 'Connectez-vous au compte propriétaire de la société à rattacher.' });
    }
    const token = String(req.body.token || '');
    const verificationToken = String(req.body.verification_token || '');
    if (!/^[a-f0-9]{64}$/i.test(token) || !/^[a-f0-9]{64}$/i.test(verificationToken)) {
      return res.status(400).json({ error: 'Lien de vérification invalide.' });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const verificationHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [[currentAccount]] = await conn.query(
      'SELECT email FROM users WHERE id = ? LIMIT 1 FOR UPDATE',
      [actor(req)]
    );
    if (!currentAccount?.email) {
      await conn.rollback();
      return res.status(403).json({ error: 'Le compte connecté doit disposer d’une adresse email.' });
    }
    const [invites] = await conn.query(
      "SELECT i.id, i.group_id, i.invited_email, i.statut, i.expire_at, g.owner_user_id, g.nom AS group_name, u.plan AS owner_plan\n" +
      "FROM pro_company_group_invitations i JOIN pro_company_groups g ON g.id = i.group_id JOIN users u ON u.id = g.owner_user_id\n" +
      "WHERE i.token_hash = ? AND i.statut = 'envoyee' AND i.expire_at > NOW() LIMIT 1 FOR UPDATE",
      [tokenHash]
    );
    const invite = invites[0];
    if (!invite) {
      await conn.rollback();
      return res.status(404).json({ error: 'Invitation expirée, révoquée ou déjà utilisée.' });
    }
    if (String(invite.invited_email).toLowerCase() !== String(currentAccount.email).toLowerCase()) {
      await conn.rollback();
      return res.status(403).json({ error: 'Connectez-vous avec le compte associé à l’adresse email invitée.' });
    }
    if (!isEnterprisePlan(invite.owner_plan)) {
      await conn.rollback();
      return res.status(409).json({ error: 'Le compte propriétaire du groupe n’a plus la formule Entreprise active.' });
    }
    if (Number(invite.owner_user_id) === actor(req)) {
      await conn.rollback();
      return res.status(400).json({ error: 'La société principale ne peut pas être ajoutée une seconde fois.' });
    }
    const [[alreadyLinked]] = await conn.query(
      'SELECT id FROM pro_company_group_companies WHERE company_owner_id = ? LIMIT 1 FOR UPDATE',
      [actor(req)]
    );
    if (alreadyLinked) {
      await conn.rollback();
      return res.status(409).json({ error: 'Cette société est déjà rattachée à un groupe.' });
    }
    const [companies] = await conn.query('SELECT id FROM users WHERE id = ? LIMIT 1', [actor(req)]);
    if (!companies.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Compte société introuvable.' });
    }
    const [proofs] = await conn.query(
      "SELECT id FROM pro_company_group_invitation_verifications " +
      "WHERE invitation_id = ? AND company_owner_id = ? AND token_hash = ? AND used_at IS NULL AND expires_at > NOW() " +
      "LIMIT 1 FOR UPDATE",
      [invite.id, actor(req), verificationHash]
    );
    const proof = proofs[0];
    if (!proof) {
      await conn.rollback();
      return res.status(404).json({ error: 'Le lien de confirmation est expiré, invalide ou déjà utilisé. Demandez un nouveau lien depuis l’invitation.' });
    }

    const [used] = await conn.query(
      "UPDATE pro_company_group_invitation_verifications SET used_at = NOW() " +
      "WHERE id = ? AND company_owner_id = ? AND token_hash = ? AND used_at IS NULL AND expires_at > NOW()",
      [proof.id, actor(req), verificationHash]
    );
    if (used.affectedRows !== 1) {
      await conn.rollback();
      return res.status(409).json({ error: 'Ce lien de confirmation a déjà été utilisé.' });
    }
    await conn.query(
      'INSERT INTO pro_company_group_companies (group_id, company_owner_id, is_primary) VALUES (?, ?, 0)',
      [invite.group_id, actor(req)]
    );
    await conn.query(
      "UPDATE pro_company_group_invitations SET statut = 'acceptee', accepted_company_owner_id = ?, accepted_at = NOW() WHERE id = ? AND group_id = ? AND statut = 'envoyee'",
      [actor(req), invite.id, invite.group_id]
    );
    await conn.query(
      "UPDATE email_outbox SET statut = 'cancelled', verrouille_le = NULL, lock_token = NULL, " +
      "dernier_code_erreur = 'invitation_accepted', updated_at = NOW() " +
      "WHERE owner_user_id = ? AND entity_type IN ('company_group_invitation', 'company_group_invitation_verification') " +
      "AND ((entity_type = 'company_group_invitation' AND entity_id = ?) " +
      "OR (entity_type = 'company_group_invitation_verification' AND entity_id = ?)) AND statut IN ('queued', 'retry')",
      [invite.owner_user_id, invite.id, proof.id]
    );
    await conn.query(
      'INSERT INTO pro_audit_logs (user_id, acteur_user_id, action, entite, entite_id, details_json, adresse_ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [invite.owner_user_id, actor(req), 'groupe.societe.invitation_acceptee', 'societe', String(actor(req)), JSON.stringify({ group_id: invite.group_id, group_name: invite.group_name, email_verified: true }), req.ip || null]
    );
    await conn.commit();

    res.set('Cache-Control', 'no-store, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({
      success: true,
      groupe_id: invite.group_id,
      entreprise_id: Number(invite.owner_user_id),
      message: 'Adresse email confirmée. Votre société a rejoint le groupe. Le propriétaire du groupe peut maintenant ouvrir cet espace avec les droits administrateur.'
    });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Cette société appartient déjà à un groupe.' });
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.delete('/company-group/companies/:companyOwnerId', async (req, res, next) => {
  try {
    if (!await assertEnterpriseGroupOwner(req, res)) return;
    if (!idOk(req.params.companyOwnerId)) return res.status(400).json({ error: 'Identifiant de société invalide.' });
    const companyOwnerId = Number(req.params.companyOwnerId);
    if (companyOwnerId === actor(req)) return res.status(400).json({ error: 'La société principale ne peut pas être retirée du groupe.' });
    const [[group]] = await pool.query(
      'SELECT id FROM pro_company_groups WHERE owner_user_id = ? LIMIT 1',
      [actor(req)]
    );
    if (!group) return res.status(404).json({ error: 'Groupe de sociétés introuvable.' });
    const [result] = await pool.query(
      'DELETE FROM pro_company_group_companies WHERE group_id = ? AND company_owner_id = ? AND is_primary = 0',
      [group.id, companyOwnerId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Société rattachée introuvable.' });
    await pool.query(
      'INSERT INTO pro_audit_logs (user_id, acteur_user_id, action, entite, entite_id, details_json, adresse_ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [actor(req), actor(req), 'groupe.societe.retiree', 'societe', String(companyOwnerId), JSON.stringify({ group_id: group.id }), req.ip || null]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});


router.delete('/company-group/leave', async (req, res, next) => {
  try {
    // Cette action est exécutée par le propriétaire de la société qui avait accepté
    // l'invitation ; elle retire uniquement cette société non principale de son groupe.
    if (actor(req) !== Number(req.user.id)) return res.status(403).json({ error: 'Compte propriétaire requis.' });
    const [[link]] = await pool.query(
      `SELECT gc.id, gc.group_id, gc.is_primary, g.owner_user_id
       FROM pro_company_group_companies gc
       JOIN pro_company_groups g ON g.id = gc.group_id
       WHERE gc.company_owner_id = ?
       LIMIT 1`,
      [actor(req)]
    );
    if (!link) return res.status(404).json({ error: 'Cette société ne fait partie d’aucun groupe.' });
    if (Number(link.is_primary) === 1 || Number(link.owner_user_id) === actor(req)) {
      return res.status(409).json({ error: 'La société principale ne peut pas quitter son propre groupe. Supprimez le groupe depuis sa gestion.' });
    }
    const [result] = await pool.query(
      'DELETE FROM pro_company_group_companies WHERE id = ? AND company_owner_id = ? AND is_primary = 0',
      [link.id, actor(req)]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Rattachement introuvable.' });
    await pool.query(
      'INSERT INTO pro_audit_logs (user_id, acteur_user_id, action, entite, entite_id, details_json, adresse_ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [link.owner_user_id, actor(req), 'groupe.societe.quitte', 'societe', String(actor(req)), JSON.stringify({ group_id: link.group_id }), req.ip || null]
    );
    res.json({ success: true, message: 'Votre société a quitté le groupe. Ses données restent dans son compte indépendant.' });
  } catch (err) { next(err); }
});

router.delete('/company-group/invitations/:invitationId', async (req, res, next) => {
  let conn;
  try {
    if (!await assertEnterpriseGroupOwner(req, res)) return;
    if (!idOk(req.params.invitationId)) return res.status(400).json({ error: 'Identifiant d’invitation invalide.' });
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [[group]] = await conn.query(
      'SELECT id FROM pro_company_groups WHERE owner_user_id = ? LIMIT 1 FOR UPDATE',
      [actor(req)]
    );
    if (!group) {
      await conn.rollback();
      return res.status(404).json({ error: 'Groupe de sociétés introuvable.' });
    }
    const [[invitation]] = await conn.query(
      "SELECT id FROM pro_company_group_invitations WHERE id = ? AND group_id = ? AND statut = 'envoyee' LIMIT 1 FOR UPDATE",
      [req.params.invitationId, group.id]
    );
    if (!invitation) {
      await conn.rollback();
      return res.status(404).json({ error: 'Invitation active introuvable.' });
    }

    await conn.query(
      "UPDATE pro_company_group_invitations SET statut = 'revoquee' WHERE id = ? AND group_id = ? AND statut = 'envoyee'",
      [invitation.id, group.id]
    );
    // Annule seulement les messages qui n'ont pas encore été réclamés.
    // Un message déjà en cours de remise SMTP peut être impossible à rappeler.
    const [cancelled] = await conn.query(
      "UPDATE email_outbox SET statut = 'cancelled', verrouille_le = NULL, lock_token = NULL, dernier_code_erreur = 'invitation_revoked', updated_at = NOW() WHERE owner_user_id = ? AND entity_type = 'company_group_invitation' AND entity_id = ? AND statut IN ('queued', 'retry')",
      [actor(req), invitation.id]
    );
    const [[emailState]] = await conn.query(
      "SELECT statut FROM email_outbox WHERE entity_type = 'company_group_invitation' AND entity_id = ? LIMIT 1",
      [invitation.id]
    );
    await conn.commit();
    res.json({
      success: true,
      email_annule: Number(cancelled.affectedRows) > 0,
      email_en_cours: emailState?.statut === 'processing',
      email_deja_envoye: emailState?.statut === 'sent'
    });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.get('/company-group/dashboard', async (req, res, next) => {
  try {
    if (!await assertEnterpriseGroupOwner(req, res)) return;
    const pagination = parseCompanyGroupPagination(req.query);
    if (pagination?.error) return res.status(400).json({ error: pagination.error });
    const [[group]] = await pool.query(
      'SELECT id, nom FROM pro_company_groups WHERE owner_user_id = ? LIMIT 1',
      [actor(req)]
    );
    if (!group) return res.status(404).json({ error: 'Groupe de sociétés introuvable.' });

    const [companies] = await pool.query(
      `SELECT gc.company_owner_id AS id, gc.is_primary, u.entreprise_nom, u.nom AS contact_nom,
              u.pays_code, u.devise, u.fuseau_horaire
       FROM pro_company_group_companies gc
       JOIN users u ON u.id = gc.company_owner_id
       WHERE gc.group_id = ?
       ORDER BY gc.is_primary DESC, u.entreprise_nom ASC, gc.company_owner_id ASC`,
      [group.id]
    );
    const ids = companies.map(company => Number(company.id));
    const paginationMeta = companyGroupPaginationMeta(ids.length, pagination);
    if (!ids.length) {
      return res.json({
        groupe: group, societes: [], factures_par_devise: [], depenses_par_devise: [],
        stocks_par_devise: [], caisses_par_devise: [], performance_mensuelle: [], alertes: [],
        ...(pagination ? { pagination: paginationMeta } : {})
      });
    }

    const slots = ids.map(() => '?').join(', ');
    const dateCase = 'CASE f.user_id ' + companies.map(() => 'WHEN ? THEN ?').join(' ') + " ELSE '9999-12-31' END";
    const dateCaseParams = companies.flatMap(company => [
      Number(company.id),
      localDateString(company.fuseau_horaire || 'Africa/Dakar')
    ]);

    const [invoiceRows] = await pool.query(
      `SELECT f.user_id, f.devise, COUNT(*) AS nombre_factures,
              COALESCE(SUM(f.total),0) AS total_facture,
              COALESCE(SUM(f.montant_paye),0) AS total_encaisse,
              COALESCE(SUM(GREATEST(f.total - f.montant_paye,0)),0) AS total_impaye,
              SUM(CASE WHEN GREATEST(f.total - f.montant_paye,0) > 0.01 THEN 1 ELSE 0 END) AS nombre_impayees,
              COALESCE(SUM(CASE
                WHEN GREATEST(f.total - f.montant_paye,0) > 0.01
                 AND (f.statut = 'en_retard' OR (f.date_echeance IS NOT NULL AND f.date_echeance < ${dateCase}))
                THEN GREATEST(f.total - f.montant_paye,0) ELSE 0 END),0) AS total_en_retard,
              SUM(CASE
                WHEN GREATEST(f.total - f.montant_paye,0) > 0.01
                 AND (f.statut = 'en_retard' OR (f.date_echeance IS NOT NULL AND f.date_echeance < ${dateCase}))
                THEN 1 ELSE 0 END) AS nombre_en_retard
       FROM factures f
       WHERE f.user_id IN (${slots}) AND f.type = 'facture' AND f.statut <> 'annulee'
       GROUP BY f.user_id, f.devise`,
      [...dateCaseParams, ...dateCaseParams, ...ids]
    );

    const [expenseRows] = await pool.query(
      `SELECT d.user_id, u.devise, COUNT(*) AS nombre_depenses,
              COALESCE(SUM(d.montant),0) AS total_depenses
       FROM depenses d
       JOIN users u ON u.id = d.user_id
       WHERE d.user_id IN (${slots})
       GROUP BY d.user_id, u.devise`,
      ids
    );

    const [stockRows] = await pool.query(
      `SELECT p.user_id, u.devise, COUNT(*) AS nombre_produits,
              SUM(CASE WHEN COALESCE(s.quantite,p.stock,0) <= 0 THEN 1 ELSE 0 END) AS ruptures_stock,
              SUM(CASE WHEN COALESCE(s.quantite,p.stock,0) > 0
                         AND COALESCE(s.quantite,p.stock,0) <= COALESCE(p.stock_minimum,0)
                       THEN 1 ELSE 0 END) AS stocks_faibles,
              COALESCE(SUM(CASE WHEN p.prix_achat > 0
                THEN COALESCE(s.quantite,p.stock,0) * p.prix_achat ELSE 0 END),0) AS valeur_stock_estimee,
              SUM(CASE WHEN COALESCE(s.quantite,p.stock,0) > 0 AND COALESCE(p.prix_achat,0) <= 0
                       THEN 1 ELSE 0 END) AS produits_sans_cout
       FROM produits p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN (
         SELECT user_id, produit_id, SUM(quantite) AS quantite
         FROM pro_stocks_entrepots
         WHERE user_id IN (${slots})
         GROUP BY user_id, produit_id
       ) s ON s.user_id = p.user_id AND s.produit_id = p.id
       WHERE p.user_id IN (${slots}) AND COALESCE(p.type_catalogue, 'non_classe') <> 'service'
       GROUP BY p.user_id, u.devise`,
      [...ids, ...ids]
    );

    const [cashRows] = await pool.query(
      `SELECT c.user_id, c.devise, COUNT(*) AS nombre_caisses,
              COALESCE(SUM(c.solde_initial + COALESCE(o.solde_operations,0)),0) AS solde_total
       FROM pro_caisses c
       LEFT JOIN (
         SELECT user_id, caisse_id,
                SUM(CASE WHEN type = 'entree' THEN montant WHEN type = 'sortie' THEN -montant ELSE 0 END) AS solde_operations
         FROM pro_caisse_operations
         WHERE user_id IN (${slots})
         GROUP BY user_id, caisse_id
       ) o ON o.user_id = c.user_id AND o.caisse_id = c.id
       WHERE c.user_id IN (${slots}) AND c.active = 1
       GROUP BY c.user_id, c.devise`,
      [...ids, ...ids]
    );

    const [performanceRows] = await pool.query(
      `SELECT user_id, devise, DATE_FORMAT(date_emission,'%Y-%m') AS mois,
              COUNT(*) AS nombre_factures, COALESCE(SUM(total),0) AS total_facture
       FROM factures
       WHERE user_id IN (${slots}) AND type = 'facture' AND statut <> 'annulee'
         AND date_emission >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
       GROUP BY user_id, devise, mois
       ORDER BY mois ASC`,
      ids
    );

    const addCurrency = (map, row, factory, apply) => {
      const currency = row.devise || 'INCONNUE';
      const item = map.get(currency) || factory(currency);
      apply(item, row);
      map.set(currency, item);
    };

    const invoiceCurrencies = new Map();
    for (const row of invoiceRows) {
      addCurrency(invoiceCurrencies, row,
        devise => ({ devise, nombre_factures: 0, total_facture: 0, total_encaisse: 0, total_impaye: 0, nombre_impayees: 0, total_en_retard: 0, nombre_en_retard: 0 }),
        (item, value) => {
          for (const field of ['nombre_factures','total_facture','total_encaisse','total_impaye','nombre_impayees','total_en_retard','nombre_en_retard']) {
            item[field] += Number(value[field] || 0);
          }
        }
      );
    }

    const expenseCurrencies = new Map();
    for (const row of expenseRows) {
      addCurrency(expenseCurrencies, row,
        devise => ({ devise, nombre_depenses: 0, total_depenses: 0 }),
        (item, value) => {
          item.nombre_depenses += Number(value.nombre_depenses || 0);
          item.total_depenses += Number(value.total_depenses || 0);
        }
      );
    }

    const stockCurrencies = new Map();
    for (const row of stockRows) {
      addCurrency(stockCurrencies, row,
        devise => ({ devise, nombre_produits: 0, ruptures_stock: 0, stocks_faibles: 0, valeur_stock_estimee: 0, produits_sans_cout: 0 }),
        (item, value) => {
          for (const field of ['nombre_produits','ruptures_stock','stocks_faibles','valeur_stock_estimee','produits_sans_cout']) {
            item[field] += Number(value[field] || 0);
          }
        }
      );
    }

    const cashCurrencies = new Map();
    for (const row of cashRows) {
      addCurrency(cashCurrencies, row,
        devise => ({ devise, nombre_caisses: 0, solde_total: 0 }),
        (item, value) => {
          item.nombre_caisses += Number(value.nombre_caisses || 0);
          item.solde_total += Number(value.solde_total || 0);
        }
      );
    }

    const companyById = new Map(companies.map(company => [Number(company.id), company]));
    const companiesForResponse = pagination
      ? companies.slice(pagination.offset, pagination.offset + pagination.limit)
      : companies;
    const companiesWithTotals = companiesForResponse.map(company => {
      const companyId = Number(company.id);
      return {
        ...company,
        factures: invoiceRows.filter(row => Number(row.user_id) === companyId).map(row => ({
          devise: row.devise, nombre: Number(row.nombre_factures), total: Number(row.total_facture),
          encaisse: Number(row.total_encaisse), impaye: Number(row.total_impaye),
          nombre_impayees: Number(row.nombre_impayees), en_retard: Number(row.total_en_retard),
          nombre_en_retard: Number(row.nombre_en_retard)
        })),
        depenses: expenseRows.filter(row => Number(row.user_id) === companyId).map(row => ({
          devise: row.devise, nombre: Number(row.nombre_depenses), total: Number(row.total_depenses)
        })),
        stock: stockRows.filter(row => Number(row.user_id) === companyId).map(row => ({
          devise: row.devise, nombre_produits: Number(row.nombre_produits),
          ruptures: Number(row.ruptures_stock), stocks_faibles: Number(row.stocks_faibles),
          valeur_estimee: Number(row.valeur_stock_estimee), produits_sans_cout: Number(row.produits_sans_cout)
        })),
        caisses: cashRows.filter(row => Number(row.user_id) === companyId).map(row => ({
          devise: row.devise, nombre: Number(row.nombre_caisses), solde: Number(row.solde_total)
        })),
        performance: performanceRows.filter(row => Number(row.user_id) === companyId).map(row => ({
          devise: row.devise, mois: row.mois, nombre_factures: Number(row.nombre_factures),
          total_facture: Number(row.total_facture)
        }))
      };
    });

    const alertes = [];
    for (const row of invoiceRows) {
      if (Number(row.nombre_en_retard || 0) > 0) {
        const company = companyById.get(Number(row.user_id));
        alertes.push({
          type: 'factures_en_retard',
          societe_id: Number(row.user_id),
          societe: company?.entreprise_nom || company?.contact_nom || 'Société',
          devise: row.devise || company?.devise || 'INCONNUE',
          nombre: Number(row.nombre_en_retard),
          montant: Number(row.total_en_retard),
          societe_is_primary: Number(company?.is_primary) === 1
        });
      }
    }
    for (const row of stockRows) {
      const lowStock = Number(row.ruptures_stock || 0) + Number(row.stocks_faibles || 0);
      if (lowStock > 0) {
        const company = companyById.get(Number(row.user_id));
        alertes.push({
          type: 'stocks_a_surveiller',
          societe_id: Number(row.user_id),
          societe: company?.entreprise_nom || company?.contact_nom || 'Société',
          devise: row.devise || company?.devise || 'INCONNUE',
          ruptures: Number(row.ruptures_stock || 0),
          stocks_faibles: Number(row.stocks_faibles || 0),
          societe_is_primary: Number(company?.is_primary) === 1
        });
      }
    }

    res.json({
      groupe: group,
      societes: companiesWithTotals,
      factures_par_devise: [...invoiceCurrencies.values()],
      depenses_par_devise: [...expenseCurrencies.values()],
      stocks_par_devise: [...stockCurrencies.values()],
      caisses_par_devise: [...cashCurrencies.values()],
      performance_mensuelle: performanceRows.map(row => ({
        devise: row.devise || 'INCONNUE', mois: row.mois,
        nombre_factures: Number(row.nombre_factures), total_facture: Number(row.total_facture)
      })),
      alertes,
      ...(pagination ? { pagination: paginationMeta } : {}),
      note: 'Les montants sont regroupés par devise ; les soldes affichés concernent uniquement les caisses actives enregistrées dans SamaFacture. La valorisation du stock utilise les prix d’achat renseignés. Aucune conversion de change ou consolidation comptable OHADA n’est réalisée.'
    });
  } catch (err) { next(err); }
});
};
