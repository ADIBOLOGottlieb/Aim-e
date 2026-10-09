const express = require('express');
const { query, tx } = require('../db');
const { allow } = require('../auth');
const { HttpError, bad, text, number, bool, id } = require('../util');

const router = express.Router();

async function loadMenu(where = 'm.archived = FALSE', params = []) {
  const items = await query(
    `SELECT m.id, m.name, m.category, m.price, m.description, m.available
     FROM menu_items m WHERE ${where} ORDER BY m.category, m.name`,
    params
  );
  const comps = await query(
    `SELECT c.menu_item_id, c.stock_item_id, c.quantity, s.name, s.unit, s.quantity AS stock_quantity
     FROM menu_components c JOIN stock_items s ON s.id = c.stock_item_id`
  );
  const byItem = new Map();
  for (const c of comps.rows) {
    if (!byItem.has(c.menu_item_id)) byItem.set(c.menu_item_id, []);
    byItem.get(c.menu_item_id).push(c);
  }
  return items.rows.map((m) => {
    const components = byItem.get(m.id) || [];
    // Nombre de portions réalisables avec le stock actuel (null = pas de suivi de stock).
    const portions = components.length
      ? Math.floor(Math.min(...components.map((c) => (c.quantity > 0 ? c.stock_quantity / c.quantity : Infinity))) + 1e-9)
      : null;
    return { ...m, components, portions: Number.isFinite(portions) ? Math.max(portions, 0) : null };
  });
}

router.get('/', async (req, res) => {
  res.json(await loadMenu());
});

function parseItem(body) {
  const components = Array.isArray(body.components) ? body.components : [];
  if (components.length > 30) throw bad('Trop d\'ingrédients');
  const seen = new Set();
  return {
    name: text(body.name, { field: 'Nom', required: true, max: 80 }),
    category: text(body.category, { field: 'Catégorie', required: true, max: 40 }),
    price: number(body.price, { field: 'Prix', min: 0, max: 1e9 }),
    description: text(body.description, { field: 'Description', max: 300 }),
    available: body.available === undefined ? true : bool(body.available),
    components: components.map((c) => {
      const stockId = id(c.stock_item_id);
      if (seen.has(stockId)) throw bad('Un article de stock apparaît deux fois dans la recette');
      seen.add(stockId);
      return { stock_item_id: stockId, quantity: number(c.quantity, { field: 'Quantité', min: 0.001, max: 1e6 }) };
    }),
  };
}

async function saveComponents(client, menuId, components) {
  await client.query('DELETE FROM menu_components WHERE menu_item_id = $1', [menuId]);
  for (const c of components) {
    const s = await client.query('SELECT id FROM stock_items WHERE id = $1 AND archived = FALSE', [c.stock_item_id]);
    if (!s.rows.length) throw bad('Article de stock introuvable');
    await client.query(
      'INSERT INTO menu_components (menu_item_id, stock_item_id, quantity) VALUES ($1, $2, $3)',
      [menuId, c.stock_item_id, c.quantity]
    );
  }
}

router.post('/', allow('gerant'), async (req, res) => {
  const item = parseItem(req.body);
  const menuId = await tx(async (client) => {
    const r = await client.query(
      `INSERT INTO menu_items (name, category, price, description, available)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [item.name, item.category, item.price, item.description, item.available]
    );
    await saveComponents(client, r.rows[0].id, item.components);
    return r.rows[0].id;
  });
  res.status(201).json((await loadMenu('m.id = $1', [menuId]))[0]);
});

router.put('/:id', allow('gerant'), async (req, res) => {
  const menuId = id(req.params.id);
  const item = parseItem(req.body);
  await tx(async (client) => {
    const r = await client.query(
      `UPDATE menu_items SET name = $1, category = $2, price = $3, description = $4, available = $5
       WHERE id = $6 AND archived = FALSE RETURNING id`,
      [item.name, item.category, item.price, item.description, item.available, menuId]
    );
    if (!r.rows.length) throw new HttpError(404, 'Plat introuvable');
    await saveComponents(client, menuId, item.components);
  });
  res.json((await loadMenu('m.id = $1', [menuId]))[0]);
});

router.patch('/:id/available', allow('gerant'), async (req, res) => {
  const menuId = id(req.params.id);
  const r = await query(
    'UPDATE menu_items SET available = $1 WHERE id = $2 AND archived = FALSE RETURNING id',
    [bool(req.body.available), menuId]
  );
  if (!r.rows.length) throw new HttpError(404, 'Plat introuvable');
  res.json({ ok: true });
});

// Les plats sont archivés (et non supprimés) pour garder l'historique des commandes.
router.delete('/:id', allow('gerant'), async (req, res) => {
  const menuId = id(req.params.id);
  await query('UPDATE menu_items SET archived = TRUE, available = FALSE WHERE id = $1', [menuId]);
  res.json({ ok: true });
});

module.exports = router;
