CREATE TABLE customers (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory (
  product_id BIGINT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'shipped', 'cancelled')),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0)
);

CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

INSERT INTO customers (email, full_name) VALUES
  ('amina@example.com', 'Amina Khan'),
  ('leo@example.com', 'Leo Schneider'),
  ('maya@example.com', 'Maya Johnson'),
  ('yusuf@example.com', 'Yusuf Demir');

INSERT INTO products (sku, name, description, price_cents, active) VALUES
  ('KB-001', 'Mechanical Keyboard', 'Compact mechanical keyboard with tactile switches.', 8999, TRUE),
  ('MS-001', 'Wireless Mouse', 'Ergonomic wireless mouse for everyday work.', 3499, TRUE),
  ('HD-001', 'USB-C Hub', 'Seven-port USB-C hub with HDMI and Ethernet.', 4999, TRUE),
  ('MN-001', 'Portable Monitor', 'Lightweight 15-inch USB-C portable monitor.', 17999, TRUE),
  ('ST-001', 'Laptop Stand', 'Adjustable aluminum laptop stand.', 3999, TRUE);

INSERT INTO inventory (product_id, quantity) VALUES
  (1, 25),
  (2, 40),
  (3, 18),
  (4, 8),
  (5, 30);

INSERT INTO orders (customer_id, status, total_cents, created_at) VALUES
  (1, 'paid', 12498, NOW() - INTERVAL '5 days'),
  (2, 'shipped', 22997, NOW() - INTERVAL '3 days'),
  (3, 'pending', 4999, NOW() - INTERVAL '1 day'),
  (4, 'paid', 3999, NOW());

INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES
  (1, 1, 1, 8999),
  (1, 2, 1, 3499),
  (2, 4, 1, 17999),
  (2, 3, 1, 4999),
  (3, 3, 1, 4999),
  (4, 5, 1, 3999);
