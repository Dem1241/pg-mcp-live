import { env } from "../config/env.js";
import { validateReadOnlySelectQuery } from "../security/sqlGuards.js";
import { normalizeLimit } from "./guards.js";
import { pool } from "./pool.js";

export type ExplainQueryResult = {
  sql: string;
  limit: number;
  plan: unknown;
  executionTimeMs: number;
};

type ExplainQueryRow = {
  "QUERY PLAN": unknown;
};

export async function explainSafeSelectQuery(
  sql: string,
  limit?: number,
): Promise<ExplainQueryResult> {
  const validated = validateReadOnlySelectQuery(sql);
  const safeLimit = normalizeLimit(limit, env.PG_MCP_MAX_ROWS);

  const client = await pool.connect();
  const startedAt = Date.now();

  try {
    await client.query("BEGIN READ ONLY");

    await client.query("SELECT set_config($1, $2, true)", [
      "statement_timeout",
      `${env.PG_MCP_STATEMENT_TIMEOUT_MS}ms`,
    ]);

    const explainSql = `
      EXPLAIN (FORMAT JSON)
      SELECT *
      FROM (
        ${validated.sql}
      ) AS pg_mcp_live_explain_result
      LIMIT $1;
    `;

    const result = await client.query<ExplainQueryRow>(explainSql, [safeLimit]);

    await client.query("COMMIT");

    return {
      sql: validated.sql,
      limit: safeLimit,
      plan: result.rows[0]?.["QUERY PLAN"] ?? null,
      executionTimeMs: Date.now() - startedAt,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
