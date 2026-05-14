CREATE OR REPLACE FUNCTION notify_pg_mcp_live_table_change()
RETURNS trigger AS $$
DECLARE
  payload json;
BEGIN
  payload = json_build_object(
    'event', 'table_change',
    'operation', TG_OP,
    'schema', TG_TABLE_SCHEMA,
    'table', TG_TABLE_NAME,
    'changedAt', NOW(),
    'oldRow', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
    'newRow', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
  );

  PERFORM pg_notify('pg_mcp_live_events', payload::text);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customers_pg_mcp_live_notify ON customers;
DROP TRIGGER IF EXISTS products_pg_mcp_live_notify ON products;
DROP TRIGGER IF EXISTS inventory_pg_mcp_live_notify ON inventory;
DROP TRIGGER IF EXISTS orders_pg_mcp_live_notify ON orders;
DROP TRIGGER IF EXISTS order_items_pg_mcp_live_notify ON order_items;

CREATE TRIGGER customers_pg_mcp_live_notify
AFTER INSERT OR UPDATE OR DELETE ON customers
FOR EACH ROW
EXECUTE FUNCTION notify_pg_mcp_live_table_change();

CREATE TRIGGER products_pg_mcp_live_notify
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW
EXECUTE FUNCTION notify_pg_mcp_live_table_change();

CREATE TRIGGER inventory_pg_mcp_live_notify
AFTER INSERT OR UPDATE OR DELETE ON inventory
FOR EACH ROW
EXECUTE FUNCTION notify_pg_mcp_live_table_change();

CREATE TRIGGER orders_pg_mcp_live_notify
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW
EXECUTE FUNCTION notify_pg_mcp_live_table_change();

CREATE TRIGGER order_items_pg_mcp_live_notify
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW
EXECUTE FUNCTION notify_pg_mcp_live_table_change();
