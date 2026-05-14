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
