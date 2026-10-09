const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { query } = require('./db');
const { HttpError } = require('./util');

const SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'production' ? null : crypto.randomBytes(32).toString('hex'));
if (!SECRET) throw new Error('JWT_SECRET est obligatoire en production');

const COOKIE = 'rt_session';
const MAX_AGE_MS = 12 * 3600 * 1000;

const ROLES = ['proprietaire', 'gerant'];

function setSession(res, user) {
  const token = jwt.sign({ sub: user.id }, SECRET, { expiresIn: '12h' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_MS,
  });
}

function clearSession(res) {
  res.clearCookie(COOKIE);
}

async function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE];
  if (!token) throw new HttpError(401, 'Non connecté');
  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    throw new HttpError(401, 'Session expirée, reconnectez-vous');
  }
  const { rows } = await query(
    'SELECT id, username, full_name, role, active FROM users WHERE id = $1',
    [payload.sub]
  );
  if (!rows[0] || !rows[0].active) throw new HttpError(401, 'Compte désactivé');
  req.user = rows[0];
  next();
}

// Le propriétaire a toujours accès à tout.
function allow(...roles) {
  return (req, res, next) => {
    if (req.user.role === 'proprietaire' || roles.includes(req.user.role)) return next();
    throw new HttpError(403, 'Accès réservé');
  };
}

module.exports = { ROLES, setSession, clearSession, requireAuth, allow };
