# MCP Tools

## `ping`

Checks whether the MCP server is running.

## `check_database_connection`

Checks whether the server can connect to the configured PostgreSQL database.

## `check_feature_support`

Reports which optional database features are installed.

The result includes:

    allowed schemas
    whether pg_mcp_live_event_log exists
    whether the live notification trigger function exists
    which allowed base tables currently have notification triggers
    which allowed base tables are still missing notification triggers

## `list_schemas`

Lists PostgreSQL schemas exposed by `PG_MCP_ALLOWED_SCHEMAS`.

## `list_tables`

Lists base tables in exposed schemas.

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

## `get_recent_events`

Returns recent table-change events from `pg_mcp_live_event_log`.

If the event log has not been installed yet, the tool returns a setup error that points to `examples/event-log.sql`.

Optional filters:

    schemaName
    tableName
    operation
    limit

Example use:

    Show me the last 10 inventory events.
    Show recent UPDATE events.
    Show recent changes in the public schema.

This tool requires the event log setup from `examples/event-log.sql`.

## `summarize_recent_activity`

Summarizes recent table-change events from `pg_mcp_live_event_log`.

If the event log has not been installed yet, the tool returns a setup error that points to `examples/event-log.sql`.

Optional filters:

    schemaName
    tableName
    operation
    sinceMinutes
    limit

The result includes:

    totalEvents
    byTable
    byOperation
    latestEvents

Example use cases:

    What changed in the last hour?
    Which tables had the most activity?
    Show recent inventory updates.
    Summarize recent UPDATE events.
