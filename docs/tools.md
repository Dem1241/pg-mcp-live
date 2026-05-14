# MCP Tools

## `ping`

Checks whether the MCP server is running.

## `check_database_connection`

Checks whether the server can connect to the configured PostgreSQL database.

## `list_schemas`

Lists PostgreSQL schemas exposed by `PG_MCP_ALLOWED_SCHEMAS`.

## `list_tables`

Lists tables in exposed schemas.

## `describe_table`

Returns table metadata, including:

- columns
- primary key columns
- foreign keys
- indexes
- unique constraints
- check constraints
- table size
- estimated row count

## `get_table_sample`

Returns a limited sample of rows from a table without allowing raw SQL input.

## `run_select_query`

Runs a guarded read-only SELECT query.

The query engine blocks write, admin, destructive, multi-statement, and row-locking SQL patterns.

## `explain_query`

Returns a PostgreSQL EXPLAIN plan for a guarded SELECT query.

This does not use `EXPLAIN ANALYZE`, so the query is planned but not executed.

## `summarize_relationships`

Returns a compact foreign-key relationship map for exposed schemas.

Example graph lines:

    public.customers.id -> public.orders.customer_id
    public.orders.id -> public.order_items.order_id
    public.products.id -> public.inventory.product_id
    public.products.id -> public.order_items.product_id

This is useful when an MCP client needs to understand the database graph quickly.

## `wait_for_notification`

Waits for the next PostgreSQL notification on a channel.

Default channel:

    pg_mcp_live_events

Example payload sent from PostgreSQL:

    SELECT pg_notify('pg_mcp_live_events', '{"event":"inventory_changed","productId":1}');

The tool returns either the notification or a timeout result.

This is the first live-event building block. Later features can build on it for table-change monitoring, event history, and Kafka bridging.
