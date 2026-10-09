const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { ROLES, allow } = require('../auth');
const { HttpError, bad, text, bool, oneOf, id, normalizeUsername } = require('../util');

const router = express.Router();
router.use(allow('proprietaire'));

const FIELDS = 'id, username, full_name, role, active, created_at';

router.get('/', async (req, res) => {
  const { rows } = await query(`SELECT ${FIELDS} FROM users ORDER BY active DESC, role, full_name`);
  res.json(rows);
});

function password(value) {
  const p = text(value, { field: 'Mot de passe', required: true, max: 100 });
  if (p.length < 8) throw bad('Le mot de passe doit faire au moins 8 caractères');
  return p;
}

router.post('/', async (req, res) => {
  const username = normalizeUsername(text(req.body.username, { field: 'Identifiant', required: true, max: 40 }));
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    throw bad('Identifiant : 3 à 40 caractères (lettres, chiffres, . _ -)');
  }
  const fullName = text(req.body.full_name, { field: 'Nom', required: true, max: 80 });
  const role = oneOf(req.body.role, ROLES, 'Rôle');
  const hash = await bcrypt.hash(password(req.body.password), 10);
  const exists = await query('SELECT id FROM users WHERE username = $1', [username]);
  if (exists.rows.length) throw new HttpError(409, 'Cet identifiant est déjà utilisé');
  const { rows } = await query(
    `INSERT INTO users (username, full_name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING ${FIELDS}`,
    [username, fullName, hash, role]
  );
  res.status(201).json(rows[0]);
});

router.patch('/:id', async (req, res) => {
  const userId = id(req.params.id);
  const { rows } = await query(`SELECT ${FIELDS} FROM users WHERE id = $1`, [userId]);
  const user = rows[0];
  if (!user) throw new HttpError(404, 'Utilisateur introuvable');

  const fullName = req.body.full_name !== undefined
    ? text(req.body.full_name, { field: 'Nom', required: true, max: 80 })
    : user.full_name;
  const role = req.body.role !== undefined ? oneOf(req.body.role, ROLES, 'Rôle') : user.role;
  const active = req.body.active !== undefined ? bool(req.body.active) : user.active;

  if (userId === req.user.id && (role !== 'proprietaire' || !active)) {
    throw bad('Vous ne pouvez pas retirer vos propres droits de propriétaire');
  }

  await query('UPDATE users SET full_name = $1, role = $2, active = $3 WHERE id = $4', [fullName, role, active, userId]);
  if (req.body.password) {
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(password(req.body.password), 10), userId]);
  }
  const updated = await query(`SELECT ${FIELDS} FROM users WHERE id = $1`, [userId]);
  res.json(updated.rows[0]);
});

module.exports = router;
