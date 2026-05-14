# pg-mcp-live

A read-only MCP server for inspecting and querying PostgreSQL databases.

`pg-mcp-live` exposes PostgreSQL schema information, table metadata, sample rows, safe SELECT queries, and query plans through the Model Context Protocol.

The goal is simple: give MCP-compatible clients useful database context without giving them write access.

## Features

- PostgreSQL schema introspection
- table and column metadata
- primary key and foreign key detection
- index metadata
- unique and check constraint metadata
- table size and row estimates
- safe sample row previews
- read-only SELECT query execution
- PostgreSQL EXPLAIN plans
- MCP tools and resources
- Docker-based demo database
- SQL guard tests

## MCP tools

| Tool | Description |
| --- | --- |
| `ping` | Checks whether the server is running |
| `check_database_connection` | Tests the PostgreSQL connection |
| `list_schemas` | Lists exposed schemas |
| `list_tables` | Lists tables in exposed schemas |
| `describe_table` | Returns table metadata |
| `get_table_sample` | Returns sample rows |
| `run_select_query` | Runs a guarded read-only SELECT query |
| `explain_query` | Returns a PostgreSQL EXPLAIN plan |
| `summarize_relationships` | Returns a compact foreign-key relationship map |
| `wait_for_notification` | Waits for the next PostgreSQL notification on a channel |
| `get_recent_events` | Returns recent table-change events from the event log |
| `summarize_recent_activity` | Summarizes recent table-change activity |

See [`docs/tools.md`](docs/tools.md) for detailed tool behavior.

## MCP resources

| Resource | Description |
| --- | --- |
| `postgres://schemas` | Lists exposed schemas |
| `postgres://schema/{schemaName}` | Lists tables in a schema |
| `postgres://table/{schemaName}/{tableName}` | Returns table metadata, indexes, constraints, and stats |

## Safety model

The server is read-only by design.

User-provided SQL is checked before execution. The query engine blocks common write, admin, and destructive operations, including:

- `INSERT`
- `UPDATE`
- `DELETE`
- `DROP`
- `ALTER`
- `TRUNCATE`
- `CREATE`
- `GRANT`
- `REVOKE`
- `COPY`
- `EXECUTE`
- `CALL`
- `MERGE`
- `VACUUM`
- `REINDEX`
- `REFRESH`
- `LOCK`
- `ANALYZE`
- `SELECT INTO`
- multiple SQL statements
- row-locking clauses such as `FOR UPDATE`

The server also uses:

- read-only transactions
- statement timeouts
- maximum row limits
- schema allowlists
- identifier validation
- safe table-name quoting

This project is still early. Do not treat it as a complete production security boundary yet.

## Requirements

- Node.js 20+
- npm
- Docker
- Docker Compose

## Quickstart

Clone the repository:

```bash
git clone https://github.com/Dem1241/pg-mcp-live.git
cd pg-mcp-live
```

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Start the demo PostgreSQL database:

```bash
docker compose -f examples/docker-compose.yml up -d
```

Run checks:

```bash
npm test
npm run typecheck
npm run build
```

Start the MCP server:

```bash
npm run dev
```

The server uses stdio transport. When started directly, it will wait for an MCP client.

## Testing with MCP Inspector

Run:

```bash
npx @modelcontextprotocol/inspector ./node_modules/.bin/tsx src/index.ts
```

Then open the Inspector URL and test the tools.

Useful first checks:

```json
{
  "tool": "ping"
}
```

```json
{
  "tool": "check_database_connection"
}
```

```json
{
  "tool": "describe_table",
  "input": {
    "schemaName": "public",
    "tableName": "order_items"
  }
}
```

```json
{
  "tool": "get_table_sample",
  "input": {
    "schemaName": "public",
    "tableName": "products",
    "limit": 3
  }
}
```

```json
{
  "tool": "run_select_query",
  "input": {
    "sql": "SELECT id, sku, name, price_cents FROM products ORDER BY id",
    "limit": 5
  }
}
```

## Demo database

The included Docker demo database contains:

- `customers`
- `products`
- `inventory`
- `orders`
- `order_items`

The schema is small on purpose. It is meant to test relationships, joins, sample rows, and query planning without needing an external database.

## Configuration

Default `.env`:

```env
DATABASE_URL=postgres://pgmcp:pgmcp@localhost:5433/pg_mcp_live_demo

PG_MCP_MAX_ROWS=100
PG_MCP_STATEMENT_TIMEOUT_MS=5000
PG_MCP_ALLOWED_SCHEMAS=public
```

### `DATABASE_URL`

PostgreSQL connection string.

### `PG_MCP_MAX_ROWS`

Maximum number of rows returned by guarded query tools.

### `PG_MCP_STATEMENT_TIMEOUT_MS`

Statement timeout used for database operations.

### `PG_MCP_ALLOWED_SCHEMAS`

Comma-separated list of schemas the server may expose.

Example:

```env
PG_MCP_ALLOWED_SCHEMAS=public,analytics
```

## Example queries

Allowed:

```sql
SELECT id, sku, name, price_cents
FROM products
ORDER BY id;
```

Allowed:

```sql
SELECT
  o.id AS order_id,
  c.full_name,
  o.status,
  o.total_cents
FROM orders o
JOIN customers c ON c.id = o.customer_id
ORDER BY o.id;
```

Rejected:

```sql
DROP TABLE products;
```

Rejected:

```sql
UPDATE inventory SET quantity = 0;
```

Rejected:

```sql
SELECT * FROM products; DROP TABLE customers;
```

Rejected:

```sql
SELECT * FROM products FOR UPDATE;
```

## Project structure

```txt
pg-mcp-live/

├── src/
│   ├── config/
│   ├── db/
│   ├── resources/
│   ├── security/
│   ├── server/
│   ├── tools/
│   └── index.ts
│
├── docs/
├── examples/
├── tests/
├── README.md
├── package.json
├── tsconfig.json
├── tsconfig.test.json
└── .env.example
```

## Development

Run tests:

```bash
npm test
```

Run typecheck:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

Start locally:

```bash
npm run dev
```

Start the demo database:

```bash
docker compose -f examples/docker-compose.yml up -d
```

Stop the demo database:

```bash
docker compose -f examples/docker-compose.yml down
```

## Roadmap

### v0.1.0

Core MCP server with PostgreSQL introspection and guarded read-only query tools.

### v0.2.0

- index metadata
- table size estimates
- richer relationship summaries
- integration tests against the demo database

### v0.3.0

- PostgreSQL LISTEN/NOTIFY support
- recent database activity tools
- event trigger examples

### v0.4.0

- Kafka bridge
- event stream summaries
- anomaly detection helpers

## License

MIT
