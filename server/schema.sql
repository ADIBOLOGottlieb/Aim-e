CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'ingredient',
  unit TEXT NOT NULL DEFAULT 'unité',
  quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  alert_threshold NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Plats',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  available BOOLEAN NOT NULL DEFAULT TRUE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_components (
  id SERIAL PRIMARY KEY,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  stock_item_id INTEGER NOT NULL REFERENCES stock_items(id),
  quantity NUMERIC(12,3) NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  table_label TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'en_cours',
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method TEXT,
  paid_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER REFERENCES menu_items(id),
  name TEXT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  quantity INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  stock_item_id INTEGER NOT NULL REFERENCES stock_items(id),
  type TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  order_id INTEGER REFERENCES orders(id),
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Divers',
  amount NUMERIC(12,2) NOT NULL,
  spent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON orders(paid_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_movements_created ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_spent ON expenses(spent_at);
