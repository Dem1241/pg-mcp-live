import type { QueryResultRow } from "pg";

import { env } from "../config/env.js";
import { quoteIdentifier } from "../security/identifiers.js";
import { validateReadOnlySelectQuery } from "../security/sqlGuards.js";
import { normalizeLimit } from "./guards.js";
import { pool } from "./pool.js";

export type SafeQueryResult = {
  sql: string;
  limit: number;
  rowCount: number;
  columns: string[];
  rows: QueryResultRow[];
  executionTimeMs: number;
};

export async function runSafeSelectQuery(
  sql: string,
  limit?: number,
): Promise<SafeQueryResult> {
  const validated = validateReadOnlySelectQuery(sql, env.PG_MCP_ALLOWED_SCHEMAS);
  const safeLimit = normalizeLimit(limit, env.PG_MCP_MAX_ROWS);
  const searchPath = [...env.PG_MCP_ALLOWED_SCHEMAS, "pg_catalog"]
    .map((schemaName) => quoteIdentifier(schemaName))
    .join(", ");

  const client = await pool.connect();
  const startedAt = Date.now();

  try {
    await client.query("BEGIN READ ONLY");

    await client.query("SELECT set_config($1, $2, true)", [
      "statement_timeout",
      `${env.PG_MCP_STATEMENT_TIMEOUT_MS}ms`,
    ]);
    await client.query("SELECT set_config($1, $2, true)", ["search_path", searchPath]);

    const wrappedSql = `
      SELECT *
      FROM (
        ${validated.sql}
      ) AS pg_mcp_live_query_result
      LIMIT $1;
    `;

    const result = await client.query<QueryResultRow>(wrappedSql, [safeLimit]);

    await client.query("COMMIT");

    return {
      sql: validated.sql,
      limit: safeLimit,
      rowCount: result.rowCount ?? result.rows.length,
      columns: result.fields.map((field) => field.name),
      rows: result.rows,
      executionTimeMs: Date.now() - startedAt,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
