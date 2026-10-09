const express = require('express');
const { query, tx } = require('../db');
const { allow } = require('../auth');
const { HttpError, bad, text, number, oneOf, id, dateRange, placeholders } = require('../util');

const router = express.Router();
router.use(allow('gerant'));

const METHODS = ['especes', 'carte', 'mobile', 'autre'];

async function withItems(orders) {
  if (!orders.length) return [];
  const ids = orders.map((o) => o.id);
  const { rows } = await query(
    `SELECT id, order_id, menu_item_id, name, unit_price, quantity
     FROM order_items WHERE order_id IN (${placeholders(ids)}) ORDER BY id`,
    ids
  );
  return orders.map((o) => ({ ...o, items: rows.filter((i) => i.order_id === o.id) }));
}

const ORDER_FIELDS = `o.id, o.table_label, o.note, o.status, o.total, o.paid, o.payment_method,
  o.paid_at, o.created_at, o.updated_at, u.full_name AS created_by_name`;

// Commandes ouvertes : pas annulées, et pas encore servies + encaissées.
router.get('/open', async (req, res) => {
  const { rows } = await query(
    `SELECT ${ORDER_FIELDS} FROM orders o LEFT JOIN users u ON u.id = o.created_by
     WHERE o.status <> 'annulee' AND (o.paid = FALSE OR o.status = 'en_cours')
     ORDER BY o.created_at`
  );
  res.json(await withItems(rows));
});

router.get('/', async (req, res) => {
  const { from, to } = dateRange(req.query, 92);
  const { rows } = await query(
    `SELECT ${ORDER_FIELDS} FROM orders o LEFT JOIN users u ON u.id = o.created_by
     WHERE o.created_at >= $1 AND o.created_at < $2
     ORDER BY o.created_at DESC LIMIT 1000`,
    [from, to]
  );
  res.json(await withItems(rows));
});

router.get('/:id', async (req, res) => {
  const { rows } = await query(
    `SELECT ${ORDER_FIELDS} FROM orders o LEFT JOIN users u ON u.id = o.created_by WHERE o.id = $1`,
    [id(req.params.id)]
  );
  if (!rows.length) throw new HttpError(404, 'Commande introuvable');
  res.json((await withItems(rows))[0]);
});

// Prise de commande : enregistre les plats et décrémente le stock selon les recettes.
router.post('/', async (req, res) => {
  const tableLabel = text(req.body.table_label, { field: 'Table', max: 40 });
  const note = text(req.body.note, { field: 'Note', max: 300 });
  const raw = Array.isArray(req.body.items) ? req.body.items : [];
  if (!raw.length) throw bad('La commande est vide');
  if (raw.length > 100) throw bad('Trop de lignes dans la commande');

  const wanted = new Map();
  for (const line of raw) {
    const menuId = id(line.menu_item_id);
    const qty = number(line.quantity, { field: 'Quantité', min: 1, max: 999, integer: true });
    wanted.set(menuId, (wanted.get(menuId) || 0) + qty);
  }
  const menuIds = [...wanted.keys()];

  const orderId = await tx(async (client) => {
    const menu = await client.query(
      `SELECT id, name, price, available FROM menu_items
       WHERE archived = FALSE AND id IN (${placeholders(menuIds)})`,
      menuIds
    );
    if (menu.rows.length !== menuIds.length) throw bad('Un plat de la commande n\'existe plus');
    const unavailable = menu.rows.filter((m) => !m.available);
    if (unavailable.length) throw bad(`Indisponible : ${unavailable.map((m) => m.name).join(', ')}`);

    // Besoin total par article de stock.
    const comps = await client.query(
      `SELECT menu_item_id, stock_item_id, quantity FROM menu_components
       WHERE menu_item_id IN (${placeholders(menuIds)})`,
      menuIds
    );
    const needs = new Map();
    for (const c of comps.rows) {
      needs.set(c.stock_item_id, (needs.get(c.stock_item_id) || 0) + c.quantity * wanted.get(c.menu_item_id));
    }

    const total = menu.rows.reduce((sum, m) => sum + m.price * wanted.get(m.id), 0);
    const order = await client.query(
      `INSERT INTO orders (table_label, note, status, total, created_by)
       VALUES ($1, $2, 'en_cours', $3, $4) RETURNING id`,
      [tableLabel, note, Math.round(total * 100) / 100, req.user.id]
    );
    const newId = order.rows[0].id;

    for (const m of menu.rows) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, name, unit_price, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [newId, m.id, m.name, m.price, wanted.get(m.id)]
      );
    }

    for (const [stockId, qty] of needs) {
      const upd = await client.query(
        `UPDATE stock_items SET quantity = quantity - $1
         WHERE id = $2 AND quantity >= $1 RETURNING id`,
        [qty, stockId]
      );
      if (!upd.rows.length) {
        const s = await client.query('SELECT name, quantity, unit FROM stock_items WHERE id = $1', [stockId]);
        const item = s.rows[0];
        throw new HttpError(409, `Stock insuffisant : ${item.name} (reste ${item.quantity} ${item.unit})`);
      }
      await client.query(
        `INSERT INTO stock_movements (stock_item_id, type, quantity, note, order_id, user_id)
         VALUES ($1, 'vente', $2, $3, $4, $5)`,
        [stockId, -qty, `Commande #${newId}`, newId, req.user.id]
      );
    }
    return newId;
  });

  const { rows } = await query(
    `SELECT ${ORDER_FIELDS} FROM orders o LEFT JOIN users u ON u.id = o.created_by WHERE o.id = $1`,
    [orderId]
  );
  res.status(201).json((await withItems(rows))[0]);
});

async function getOrder(client, orderId) {
  const { rows } = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!rows.length) throw new HttpError(404, 'Commande introuvable');
  return rows[0];
}

router.post('/:id/serve', async (req, res) => {
  const orderId = id(req.params.id);
  const order = await getOrder({ query }, orderId);
  if (order.status !== 'en_cours') throw bad('Cette commande n\'est plus en cours');
  await query(`UPDATE orders SET status = 'servie', updated_at = NOW() WHERE id = $1`, [orderId]);
  res.json({ ok: true });
});

router.post('/:id/pay', async (req, res) => {
  const orderId = id(req.params.id);
  const method = oneOf(req.body.method, METHODS, 'Mode de paiement');
  const order = await getOrder({ query }, orderId);
  if (order.status === 'annulee') throw bad('Commande annulée');
  if (order.paid) throw bad('Commande déjà encaissée');
  await query(
    `UPDATE orders SET paid = TRUE, payment_method = $1, paid_at = NOW(), updated_at = NOW() WHERE id = $2`,
    [method, orderId]
  );
  res.json({ ok: true });
});

// Annulation : la commande n'est plus comptée et le stock consommé est restitué.
router.post('/:id/cancel', async (req, res) => {
  const orderId = id(req.params.id);
  await tx(async (client) => {
    const order = await getOrder(client, orderId);
    if (order.status === 'annulee') throw bad('Commande déjà annulée');
    if (order.paid) throw bad('Une commande encaissée ne peut pas être annulée');
    const moves = await client.query(
      `SELECT stock_item_id, quantity FROM stock_movements WHERE order_id = $1 AND type = 'vente'`,
      [orderId]
    );
    for (const m of moves.rows) {
      await client.query('UPDATE stock_items SET quantity = quantity - $1 WHERE id = $2', [m.quantity, m.stock_item_id]);
      await client.query(
        `INSERT INTO stock_movements (stock_item_id, type, quantity, note, order_id, user_id)
         VALUES ($1, 'annulation', $2, $3, $4, $5)`,
        [m.stock_item_id, -m.quantity, `Annulation commande #${orderId}`, orderId, req.user.id]
      );
    }
    await client.query(`UPDATE orders SET status = 'annulee', updated_at = NOW() WHERE id = $1`, [orderId]);
  });
  res.json({ ok: true });
});

module.exports = router;
