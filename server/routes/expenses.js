const express = require('express');
const { query } = require('../db');
const { allow } = require('../auth');
const { HttpError, text, number, id, dateRange } = require('../util');

const router = express.Router();
router.use(allow('gerant'));

router.get('/', async (req, res) => {
  const { from, to } = dateRange(req.query);
  if (req.user.role !== 'proprietaire' && to - from > 36 * 3600 * 1000) {
    throw new HttpError(403, 'Seul le propriétaire peut consulter l\'historique des dépenses');
  }
  const { rows } = await query(
    `SELECT e.id, e.label, e.category, e.amount, e.spent_at, u.full_name AS user_name
     FROM expenses e LEFT JOIN users u ON u.id = e.user_id
     WHERE e.spent_at >= $1 AND e.spent_at < $2
     ORDER BY e.spent_at DESC, e.id DESC`,
    [from, to]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const label = text(req.body.label, { field: 'Libellé', required: true, max: 120 });
  const category = text(req.body.category, { field: 'Catégorie', required: true, max: 40 });
  const amount = number(req.body.amount, { field: 'Montant', min: 0.01, max: 1e10 });
  let spentAt = new Date();
  if (req.body.spent_at) {
    spentAt = new Date(req.body.spent_at);
    if (Number.isNaN(spentAt.getTime())) throw new HttpError(400, 'Date invalide');
  }
  const { rows } = await query(
    `INSERT INTO expenses (label, category, amount, spent_at, user_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, label, category, amount, spent_at`,
    [label, category, amount, spentAt, req.user.id]
  );
  res.status(201).json(rows[0]);
});

router.delete('/:id', allow('proprietaire'), async (req, res) => {
  await query('DELETE FROM expenses WHERE id = $1', [id(req.params.id)]);
  res.json({ ok: true });
});

module.exports = router;
