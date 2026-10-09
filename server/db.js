const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pg = require('pg');

// NUMERIC et BIGINT arrivent en chaînes par défaut : on les convertit en nombres.
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

let pool;
let inMemory = false;

if (process.env.DATABASE_URL) {
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 10,
  });
} else {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL est obligatoire en production');
  }
  const { newDb } = require('pg-mem');
  const mem = newDb();
  const adapter = mem.adapters.createPg();
  pool = new adapter.Pool();
  inMemory = true;
}

const query = (text, params) => pool.query(text, params);

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  for (const statement of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
    await query(statement);
  }
}

async function countRows(table) {
  const { rows } = await query(`SELECT COUNT(*) AS n FROM ${table}`);
  return Number(rows[0].n);
}

async function seedOwner() {
  if ((await countRows('users')) > 0) return;
  const username = (process.env.OWNER_USERNAME || 'proprietaire').toLowerCase();
  let password = process.env.OWNER_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('OWNER_PASSWORD est obligatoire au premier démarrage en production');
    }
    password = 'proprietaire123';
  }
  const hash = await bcrypt.hash(password, 10);
  await query(
    'INSERT INTO users (username, full_name, password_hash, role) VALUES ($1, $2, $3, $4)',
    [username, 'Propriétaire', hash, 'proprietaire']
  );
  console.log(`Compte propriétaire créé : ${username}`);
}

async function seedSettings() {
  const defaults = {
    restaurant_name: process.env.RESTAURANT_NAME || 'La Belle Table',
    currency: process.env.CURRENCY || 'FCFA',
  };
  for (const [key, value] of Object.entries(defaults)) {
    const { rows } = await query('SELECT key FROM settings WHERE key = $1', [key]);
    if (!rows.length) await query('INSERT INTO settings (key, value) VALUES ($1, $2)', [key, value]);
  }
}

async function seedDemo() {
  if ((await countRows('menu_items')) > 0) return;

  const stock = [
    ['Spaghetti', 'ingredient', 'kg', 10, 2, 1500],
    ['Viande hachée', 'ingredient', 'kg', 6, 1.5, 4500],
    ['Sauce tomate', 'ingredient', 'L', 8, 2, 1200],
    ['Poulet', 'ingredient', 'pièce', 12, 4, 3500],
    ['Riz', 'ingredient', 'kg', 15, 3, 800],
    ['Poisson', 'ingredient', 'pièce', 8, 3, 3000],
    ['Coca-Cola 33cl', 'boisson', 'bouteille', 48, 12, 350],
    ['Eau minérale 50cl', 'boisson', 'bouteille', 60, 12, 200],
    ['Jus de bissap', 'boisson', 'bouteille', 20, 6, 300],
    ['Bière 65cl', 'boisson', 'bouteille', 10, 12, 600],
    ['Serviettes', 'autre', 'paquet', 10, 3, 1000],
  ];
  const stockIds = {};
  for (const [name, category, unit, qty, alert, cost] of stock) {
    const r = await query(
      `INSERT INTO stock_items (name, category, unit, quantity, alert_threshold, unit_cost)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name, category, unit, qty, alert, cost]
    );
    stockIds[name] = r.rows[0].id;
  }

  const menu = [
    ['Salade César', 'Entrées', 3500, 'Laitue, croûtons, parmesan', []],
    ['Soupe du jour', 'Entrées', 2500, 'Selon le marché', []],
    ['Spaghetti bolognaise', 'Plats', 6000, 'Sauce maison mijotée', [['Spaghetti', 0.15], ['Viande hachée', 0.12], ['Sauce tomate', 0.15]]],
    ['Poulet braisé', 'Plats', 7500, 'Accompagné de riz ou d\'alloco', [['Poulet', 1], ['Riz', 0.2]]],
    ['Poisson grillé', 'Plats', 8500, 'Poisson du jour, sauce oignon', [['Poisson', 1], ['Riz', 0.2]]],
    ['Fondant au chocolat', 'Desserts', 3000, 'Cœur coulant', []],
    ['Salade de fruits', 'Desserts', 2000, 'Fruits de saison', []],
    ['Coca-Cola', 'Boissons', 1000, '33 cl', [['Coca-Cola 33cl', 1]]],
    ['Eau minérale', 'Boissons', 500, '50 cl', [['Eau minérale 50cl', 1]]],
    ['Jus de bissap', 'Boissons', 1000, 'Fait maison', [['Jus de bissap', 1]]],
    ['Bière', 'Boissons', 1500, '65 cl', [['Bière 65cl', 1]]],
  ];
  for (const [name, category, price, description, components] of menu) {
    const r = await query(
      `INSERT INTO menu_items (name, category, price, description)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [name, category, price, description]
    );
    for (const [stockName, qty] of components) {
      await query(
        'INSERT INTO menu_components (menu_item_id, stock_item_id, quantity) VALUES ($1, $2, $3)',
        [r.rows[0].id, stockIds[stockName], qty]
      );
    }
  }

  const demoUsers = [['gerant', 'Gérant', 'gerant', 'gerant123']];
  for (const [username, fullName, role, password] of demoUsers) {
    const exists = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (exists.rows.length) continue;
    await query(
      'INSERT INTO users (username, full_name, password_hash, role) VALUES ($1, $2, $3, $4)',
      [username, fullName, await bcrypt.hash(password, 10), role]
    );
  }
  console.log('Données de démonstration ajoutées.');
}

async function init() {
  await migrate();
  await seedOwner();
  await seedSettings();
  const demo = process.env.SEED_DEMO ? process.env.SEED_DEMO === 'true' : inMemory;
  if (demo) await seedDemo();
  if (inMemory) {
    console.warn('⚠ Aucune DATABASE_URL : base en mémoire (données perdues à l\'arrêt).');
  }
}

module.exports = { query, tx, init };
