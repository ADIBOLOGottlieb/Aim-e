const express = require('express');
const { query, tx } = require('../db');
const { allow } = require('../auth');
const { HttpError, bad, text, number, oneOf, id } = require('../util');

const router = express.Router();
router.use(allow('gerant'));

const CATEGORIES = ['boisson', 'ingredient', 'autre'];
const FIELDS = 'id, name, category, unit, quantity, alert_threshold, unit_cost';

router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT ${FIELDS} FROM stock_items WHERE archived = FALSE ORDER BY category, name`
  );
  res.json(rows);
});

router.get('/movements', async (req, res) => {
  const limit = req.query.limit ? number(req.query.limit, { min: 1, max: 500, integer: true }) : 200;
  const params = [limit];
  let filter = '';
  if (req.query.stock_item_id) {
    params.push(id(req.query.stock_item_id));
    filter = 'WHERE m.stock_item_id = $2';
  }
  const { rows } = await query(
    `SELECT m.id, m.type, m.quantity, m.unit_cost, m.note, m.order_id, m.created_at,
            s.name AS item_name, s.unit, u.full_name AS user_name
     FROM stock_movements m
     JOIN stock_items s ON s.id = m.stock_item_id
     LEFT JOIN users u ON u.id = m.user_id
     ${filter}
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT $1`,
    params
  );
  res.json(rows);
});

function parseItem(body) {
  return {
    name: text(body.name, { field: 'Nom', required: true, max: 80 }),
    category: oneOf(body.category, CATEGORIES, 'Catégorie'),
    unit: text(body.unit, { field: 'Unité', required: true, max: 20 }),
    alert_threshold: number(body.alert_threshold ?? 0, { field: 'Seuil d\'alerte', min: 0, max: 1e7 }),
    unit_cost: number(body.unit_cost ?? 0, { field: 'Coût unitaire', min: 0, max: 1e9 }),
  };
}

router.post('/', async (req, res) => {
  const item = parseItem(req.body);
  const initial = number(req.body.quantity ?? 0, { field: 'Quantité initiale', min: 0, max: 1e7 });
  const created = await tx(async (client) => {
    const r = await client.query(
      `INSERT INTO stock_items (name, category, unit, quantity, alert_threshold, unit_cost)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${FIELDS}`,
      [item.name, item.category, item.unit, initial, item.alert_threshold, item.unit_cost]
    );
    if (initial > 0) {
      await client.query(
        `INSERT INTO stock_movements (stock_item_id, type, quantity, note, user_id)
         VALUES ($1, 'inventaire', $2, 'Stock initial', $3)`,
        [r.rows[0].id, initial, req.user.id]
      );
    }
    return r.rows[0];
  });
  res.status(201).json(created);
});

router.put('/:id', async (req, res) => {
  const stockId = id(req.params.id);
  const item = parseItem(req.body);
  const { rows } = await query(
    `UPDATE stock_items SET name = $1, category = $2, unit = $3, alert_threshold = $4, unit_cost = $5
     WHERE id = $6 AND archived = FALSE RETURNING ${FIELDS}`,
    [item.name, item.category, item.unit, item.alert_threshold, item.unit_cost, stockId]
  );
  if (!rows.length) throw new HttpError(404, 'Article introuvable');
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const stockId = id(req.params.id);
  const used = await query(
    `SELECT m.name FROM menu_components c JOIN menu_items m ON m.id = c.menu_item_id
     WHERE c.stock_item_id = $1 AND m.archived = FALSE`,
    [stockId]
  );
  if (used.rows.length) {
    throw bad(`Article utilisé dans : ${used.rows.map((r) => r.name).join(', ')}. Retirez-le d'abord de ces plats.`);
  }
  await query('UPDATE stock_items SET archived = TRUE WHERE id = $1', [stockId]);
  res.json({ ok: true });
});

// entree = réapprovisionnement (achat), sortie = perte / casse / usage, inventaire = comptage réel
router.post('/:id/movements', async (req, res) => {
  const stockId = id(req.params.id);
  const type = oneOf(req.body.type, ['entree', 'sortie', 'inventaire'], 'Type de mouvement');
  const note = text(req.body.note, { field: 'Note', max: 200 });

  const updated = await tx(async (client) => {
    const r = await client.query(`SELECT ${FIELDS} FROM stock_items WHERE id = $1 AND archived = FALSE`, [stockId]);
    const item = r.rows[0];
    if (!item) throw new HttpError(404, 'Article introuvable');

    let delta;
    let unitCost = 0;
    if (type === 'entree') {
      delta = number(req.body.quantity, { field: 'Quantité', min: 0.001, max: 1e7 });
      unitCost = req.body.unit_cost === undefined || req.body.unit_cost === ''
        ? item.unit_cost
        : number(req.body.unit_cost, { field: 'Coût unitaire', min: 0, max: 1e9 });
    } else if (type === 'sortie') {
      delta = -number(req.body.quantity, { field: 'Quantité', min: 0.001, max: 1e7 });
      if (item.quantity + delta < -1e-9) throw bad(`Stock insuffisant (${item.quantity} ${item.unit} disponibles)`);
    } else {
      const counted = number(req.body.quantity, { field: 'Quantité comptée', min: 0, max: 1e7 });
      delta = counted - item.quantity;
    }

    await client.query('UPDATE stock_items SET quantity = quantity + $1 WHERE id = $2', [delta, stockId]);
    if (type === 'entree' && unitCost > 0) {
      await client.query('UPDATE stock_items SET unit_cost = $1 WHERE id = $2', [unitCost, stockId]);
    }
    await client.query(
      `INSERT INTO stock_movements (stock_item_id, type, quantity, unit_cost, note, user_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [stockId, type, delta, unitCost, note, req.user.id]
    );
    const after = await client.query(`SELECT ${FIELDS} FROM stock_items WHERE id = $1`, [stockId]);
    return after.rows[0];
  });
  res.json(updated);
});

module.exports = router;
