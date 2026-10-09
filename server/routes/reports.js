const express = require('express');
const { query } = require('../db');
const { allow } = require('../auth');
const { HttpError, number, dateRange } = require('../util');

const router = express.Router();
router.use(allow('gerant'));

const round = (n) => Math.round(n * 100) / 100;

// Clé de jour (AAAA-MM-JJ) dans le fuseau du client. tz = Date#getTimezoneOffset() côté navigateur.
const dayKey = (date, tz) => new Date(new Date(date).getTime() - tz * 60000).toISOString().slice(0, 10);

router.get('/summary', async (req, res) => {
  const { from, to } = dateRange(req.query, 400);
  // Le gérant ne voit que la caisse du jour ; le propriétaire voit tout l'historique.
  if (req.user.role !== 'proprietaire' && to - from > 36 * 3600 * 1000) {
    throw new HttpError(403, 'Seul le propriétaire peut consulter les comptes sur plusieurs jours');
  }
  const tz = req.query.tz ? number(req.query.tz, { min: -900, max: 900, integer: true }) : 0;
  const range = [from, to];

  const [paid, purchases, expenses, top, cancelled, open, stockValue] = await Promise.all([
    query('SELECT id, total, payment_method, paid_at FROM orders WHERE paid = TRUE AND paid_at >= $1 AND paid_at < $2', range),
    query(
      `SELECT m.quantity, m.unit_cost, m.created_at, s.name FROM stock_movements m
       JOIN stock_items s ON s.id = m.stock_item_id
       WHERE m.type = 'entree' AND m.created_at >= $1 AND m.created_at < $2`,
      range
    ),
    query('SELECT category, amount, spent_at FROM expenses WHERE spent_at >= $1 AND spent_at < $2', range),
    query(
      `SELECT oi.name, SUM(oi.quantity) AS qty, SUM(oi.quantity * oi.unit_price) AS amount
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.paid = TRUE AND o.paid_at >= $1 AND o.paid_at < $2
       GROUP BY oi.name`,
      range
    ),
    query(`SELECT COUNT(*) AS n FROM orders WHERE status = 'annulee' AND updated_at >= $1 AND updated_at < $2`, range),
    query(`SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS amount FROM orders WHERE status <> 'annulee' AND paid = FALSE`),
    query('SELECT COALESCE(SUM(quantity * unit_cost), 0) AS v FROM stock_items WHERE archived = FALSE AND quantity > 0'),
  ]);

  // Série quotidienne sur toute la période.
  const days = new Map();
  for (let t = from.getTime(); t < to.getTime(); t += 86400000) {
    days.set(dayKey(t, tz), { day: dayKey(t, tz), revenue: 0, costs: 0, orders: 0 });
  }
  const bucket = (date) => {
    const k = dayKey(date, tz);
    if (!days.has(k)) days.set(k, { day: k, revenue: 0, costs: 0, orders: 0 });
    return days.get(k);
  };

  const byMethod = {};
  let revenue = 0;
  for (const o of paid.rows) {
    revenue += o.total;
    byMethod[o.payment_method] = (byMethod[o.payment_method] || 0) + o.total;
    const b = bucket(o.paid_at);
    b.revenue += o.total;
    b.orders += 1;
  }

  let purchaseTotal = 0;
  for (const p of purchases.rows) {
    const cost = p.quantity * p.unit_cost;
    purchaseTotal += cost;
    bucket(p.created_at).costs += cost;
  }

  const byCategory = {};
  let expenseTotal = 0;
  for (const e of expenses.rows) {
    expenseTotal += e.amount;
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    bucket(e.spent_at).costs += e.amount;
  }

  const count = paid.rows.length;
  res.json({
    revenue: round(revenue),
    orders: count,
    average_ticket: count ? round(revenue / count) : 0,
    purchases: round(purchaseTotal),
    expenses: round(expenseTotal),
    result: round(revenue - purchaseTotal - expenseTotal),
    cancelled: Number(cancelled.rows[0].n),
    open_orders: Number(open.rows[0].n),
    open_amount: round(Number(open.rows[0].amount)),
    stock_value: round(Number(stockValue.rows[0].v)),
    by_method: Object.entries(byMethod).map(([method, amount]) => ({ method, amount: round(amount) })),
    by_expense_category: Object.entries(byCategory)
      .map(([category, amount]) => ({ category, amount: round(amount) }))
      .sort((a, b) => b.amount - a.amount),
    top_items: top.rows
      .map((r) => ({ name: r.name, qty: Number(r.qty), amount: round(Number(r.amount)) }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10),
    daily: [...days.values()]
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((d) => ({ ...d, revenue: round(d.revenue), costs: round(d.costs) })),
  });
});

module.exports = router;
