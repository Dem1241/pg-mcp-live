import { assertSafeIdentifier, quoteQualifiedTableName } from "../security/identifiers.js";
import { ensureSchemaIsAllowed, normalizeLimit } from "./guards.js";
import { pool } from "./pool.js";

export type TableSample = {
  schemaName: string;
  tableName: string;
  limit: number;
  rowCount: number;
  rows: Record<string, unknown>[];
};

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

export async function getTableSample(
  schemaName: string,
  tableName: string,
  limit?: number,
): Promise<TableSample> {
  ensureSchemaIsAllowed(schemaName);

  assertSafeIdentifier(schemaName, "schema name");
  assertSafeIdentifier(tableName, "table name");

  await assertTableExists(schemaName, tableName);

  const safeLimit = normalizeLimit(limit, 10);
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
