const express = require('express');
const { query } = require('../db');
const { allow } = require('../auth');
const { text } = require('../util');

const router = express.Router();

async function readSettings() {
  const { rows } = await query('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

router.get('/', async (req, res) => {
  res.json(await readSettings());
});

router.put('/', allow('proprietaire'), async (req, res) => {
  const values = {
    restaurant_name: text(req.body.restaurant_name, { field: 'Nom du restaurant', required: true, max: 80 }),
    currency: text(req.body.currency, { field: 'Devise', required: true, max: 10 }),
  };
  for (const [key, value] of Object.entries(values)) {
    await query('UPDATE settings SET value = $1 WHERE key = $2', [value, key]);
  }
  res.json(await readSettings());
});

module.exports = router;
