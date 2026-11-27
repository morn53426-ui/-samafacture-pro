'use strict';

async function linkGoogleIdentity(pool, user, googleId, createPasswordHash) {
  if (!user || !user.id || !googleId) return null;
  if (user.google_id === googleId) return user;
  if (user.google_id) return null;

  const passwordHash = await createPasswordHash();
  try {
    await pool.query(
      "UPDATE users SET google_id = ?, password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL, token_version = token_version + 1 WHERE id = ? AND (google_id IS NULL OR google_id = '')",
      [googleId, passwordHash, user.id]
    );
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') return null;
    throw err;
  }

  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [user.id]);
  const linkedUser = rows[0];
  return linkedUser && linkedUser.google_id === googleId ? linkedUser : null;
}

async function findGoogleUserAfterInsertConflict(pool, googleId, email) {
  const [googleRows] = await pool.query(
    'SELECT * FROM users WHERE google_id = ? LIMIT 1',
    [googleId]
  );
  if (googleRows.length) return { source: 'google', user: googleRows[0] };

  const [emailRows] = await pool.query(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  if (emailRows.length) return { source: 'email', user: emailRows[0] };
  return { source: 'missing', user: null };
}

module.exports = { linkGoogleIdentity, findGoogleUserAfterInsertConflict };