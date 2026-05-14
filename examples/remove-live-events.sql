DROP TRIGGER IF EXISTS customers_pg_mcp_live_notify ON customers;
DROP TRIGGER IF EXISTS products_pg_mcp_live_notify ON products;
DROP TRIGGER IF EXISTS inventory_pg_mcp_live_notify ON inventory;
DROP TRIGGER IF EXISTS orders_pg_mcp_live_notify ON orders;
DROP TRIGGER IF EXISTS order_items_pg_mcp_live_notify ON order_items;

DROP FUNCTION IF EXISTS notify_pg_mcp_live_table_change();
