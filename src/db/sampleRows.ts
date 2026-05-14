import { env } from "../config/env.js";
import { assertSafeIdentifier, quoteQualifiedTableName } from "../security/identifiers.js";
import { pool } from "./pool.js";

export type TableSample = {
  schemaName: string;
  tableName: string;
  limit: number;
  rowCount: number;
  rows: Record<string, unknown>[];
};

function ensureSchemaIsAllowed(schemaName: string) {
  if (!env.PG_MCP_ALLOWED_SCHEMAS.includes(schemaName)) {
    throw new Error(
      `Schema "${schemaName}" is not allowed. Allowed schemas: ${env.PG_MCP_ALLOWED_SCHEMAS.join(", ")}`,
    );
  }
}

async function assertTableExists(schemaName: string, tableName: string) {
  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_name = $2
          AND table_type = 'BASE TABLE'
      ) AS exists;
    `,
    [schemaName, tableName],
  );

  if (!result.rows[0]?.exists) {
    throw new Error(`Table "${schemaName}.${tableName}" does not exist or is not a base table.`);
  }
}

function normalizeLimit(limit: number | undefined) {
  if (limit === undefined) {
    return Math.min(10, env.PG_MCP_MAX_ROWS);
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("Limit must be a positive integer.");
  }

  return Math.min(limit, env.PG_MCP_MAX_ROWS);
}

export async function getTableSample(
  schemaName: string,
  tableName: string,
  limit?: number,
): Promise<TableSample> {
  ensureSchemaIsAllowed(schemaName);

  assertSafeIdentifier(schemaName, "schema name");
  assertSafeIdentifier(tableName, "table name");

  await assertTableExists(schemaName, tableName);

  const safeLimit = normalizeLimit(limit);
  const qualifiedTableName = quoteQualifiedTableName(schemaName, tableName);

  const result = await pool.query<Record<string, unknown>>(
    `
      SELECT *
      FROM ${qualifiedTableName}
      LIMIT $1;
    `,
    [safeLimit],
  );

  return {
    schemaName,
    tableName,
    limit: safeLimit,
    rowCount: result.rowCount ?? result.rows.length,
    rows: result.rows,
  };
}
