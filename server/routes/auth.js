const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { setSession, clearSession, requireAuth } = require('../auth');
const { HttpError, text, normalizeUsername } = require('../util');

const router = express.Router();

// Limite simple des tentatives de connexion par IP.
const attempts = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

function checkLimit(ip) {
  const entry = attempts.get(ip);
  if (entry && entry.until > Date.now() && entry.count >= MAX_ATTEMPTS) {
    throw new HttpError(429, 'Trop de tentatives. Réessayez dans quelques minutes.');
  }
}

function recordFailure(ip) {
  const entry = attempts.get(ip);
  if (!entry || entry.until < Date.now()) {
    attempts.set(ip, { count: 1, until: Date.now() + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

router.post('/login', async (req, res) => {
  checkLimit(req.ip);
  const username = normalizeUsername(text(req.body.username, { field: 'Identifiant', required: true, max: 60 }));
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const { rows } = await query('SELECT * FROM users WHERE username = $1', [username]);
  const user = rows[0];
  const ok = user && user.active && (await bcrypt.compare(password, user.password_hash));
  if (!ok) {
    recordFailure(req.ip);
    throw new HttpError(401, 'Identifiant ou mot de passe incorrect');
  }
  attempts.delete(req.ip);
  setSession(res, user);
  res.json({ user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } });
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/password', requireAuth, async (req, res) => {
  const current = typeof req.body.current === 'string' ? req.body.current : '';
  const next = text(req.body.next, { field: 'Nouveau mot de passe', required: true, max: 100 });
  if (next.length < 8) throw new HttpError(400, 'Le mot de passe doit faire au moins 8 caractères');
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!(await bcrypt.compare(current, rows[0].password_hash))) {
    throw new HttpError(400, 'Mot de passe actuel incorrect');
  }
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(next, 10), req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
