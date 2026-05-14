CREATE TABLE IF NOT EXISTS pg_mcp_live_event_log (
  id BIGSERIAL PRIMARY KEY,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  schema_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  old_row JSONB,
  new_row JSONB
);

CREATE INDEX IF NOT EXISTS idx_pg_mcp_live_event_log_changed_at
  ON pg_mcp_live_event_log (changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_pg_mcp_live_event_log_table
  ON pg_mcp_live_event_log (schema_name, table_name, changed_at DESC);

CREATE OR REPLACE FUNCTION notify_pg_mcp_live_table_change()
RETURNS trigger AS $$
DECLARE
  event_id bigint;
  payload json;
BEGIN
  INSERT INTO pg_mcp_live_event_log (
    operation,
    schema_name,
    table_name,
    changed_at,
    old_row,
    new_row
  )
  VALUES (
    TG_OP,
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    NOW(),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  )
  RETURNING id INTO event_id;

  payload = json_build_object(
    'event', 'table_change',
    'eventId', event_id,
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
