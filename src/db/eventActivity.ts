import { env } from "../config/env.js";
import { assertSafeIdentifier } from "../security/identifiers.js";
import { pool } from "./pool.js";
import type { EventOperation, RecentEvent } from "./recentEvents.js";

export type SummarizeRecentActivityOptions = {
  schemaName?: string;
  tableName?: string;
  operation?: EventOperation;
  sinceMinutes?: number;
  limit?: number;
};

export type TableActivitySummary = {
  schemaName: string;
  tableName: string;
  totalEvents: number;
  insertCount: number;
  updateCount: number;
  deleteCount: number;
  lastChangedAt: string;
};

export type OperationActivitySummary = {
  operation: EventOperation;
  count: number;
};

export type RecentActivitySummary = {
  generatedAt: string;
  filters: {
    schemas: string[];
    tableName: string | null;
    operation: EventOperation | null;
    sinceMinutes: number;
    since: string;
    limit: number;
  };
  totalEvents: number;
  byTable: TableActivitySummary[];
  byOperation: OperationActivitySummary[];
  latestEvents: RecentEvent[];
};

type CountRow = {
  total_events: string | number;
};

type TableActivityRow = {
  schema_name: string;
  table_name: string;
  total_events: string | number;
  insert_count: string | number;
  update_count: string | number;
  delete_count: string | number;
  last_changed_at: Date;
};

type OperationActivityRow = {
  operation: EventOperation;
  count: string | number;
};

type LatestEventRow = {
  id: string;
  operation: EventOperation;
  schema_name: string;
  table_name: string;
  changed_at: Date;
  old_row: Record<string, unknown> | null;
  new_row: Record<string, unknown> | null;
};

function ensureSchemaIsAllowed(schemaName: string) {
  if (!env.PG_MCP_ALLOWED_SCHEMAS.includes(schemaName)) {
    throw new Error(
      `Schema "${schemaName}" is not allowed. Allowed schemas: ${env.PG_MCP_ALLOWED_SCHEMAS.join(", ")}`,
    );
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

function normalizeSinceMinutes(sinceMinutes: number | undefined) {
  if (sinceMinutes === undefined) {
    return 60;
  }

  if (!Number.isInteger(sinceMinutes) || sinceMinutes <= 0) {
    throw new Error("sinceMinutes must be a positive integer.");
  }

  return Math.min(sinceMinutes, 60 * 24 * 30);
}

export async function summarizeRecentActivity(
  options: SummarizeRecentActivityOptions = {},
): Promise<RecentActivitySummary> {
  if (options.schemaName) {
    ensureSchemaIsAllowed(options.schemaName);
  }

  if (options.tableName) {
    assertSafeIdentifier(options.tableName, "table name");
  }

  const schemas = options.schemaName ? [options.schemaName] : env.PG_MCP_ALLOWED_SCHEMAS;
  const safeLimit = normalizeLimit(options.limit);
  const safeSinceMinutes = normalizeSinceMinutes(options.sinceMinutes);
  const since = new Date(Date.now() - safeSinceMinutes * 60 * 1000);

  const params = [
    schemas,
    options.tableName ?? null,
    options.operation ?? null,
    since.toISOString(),
  ];

  const totalResult = await pool.query<CountRow>(
    `
      SELECT COUNT(*) AS total_events
      FROM pg_mcp_live_event_log
      WHERE schema_name = ANY($1::text[])
        AND ($2::text IS NULL OR table_name = $2)
        AND ($3::text IS NULL OR operation = $3)
        AND changed_at >= $4::timestamptz;
    `,
    params,
  );

  const byTableResult = await pool.query<TableActivityRow>(
    `
      SELECT
        schema_name,
        table_name,
        COUNT(*) AS total_events,
        COUNT(*) FILTER (WHERE operation = 'INSERT') AS insert_count,
        COUNT(*) FILTER (WHERE operation = 'UPDATE') AS update_count,
        COUNT(*) FILTER (WHERE operation = 'DELETE') AS delete_count,
        MAX(changed_at) AS last_changed_at
      FROM pg_mcp_live_event_log
      WHERE schema_name = ANY($1::text[])
        AND ($2::text IS NULL OR table_name = $2)
        AND ($3::text IS NULL OR operation = $3)
        AND changed_at >= $4::timestamptz
      GROUP BY schema_name, table_name
      ORDER BY total_events DESC, last_changed_at DESC
      LIMIT $5;
    `,
    [...params, safeLimit],
  );

  const byOperationResult = await pool.query<OperationActivityRow>(
    `
      SELECT
        operation,
        COUNT(*) AS count
      FROM pg_mcp_live_event_log
      WHERE schema_name = ANY($1::text[])
        AND ($2::text IS NULL OR table_name = $2)
        AND ($3::text IS NULL OR operation = $3)
        AND changed_at >= $4::timestamptz
      GROUP BY operation
      ORDER BY count DESC, operation;
    `,
    params,
  );

  const latestEventsResult = await pool.query<LatestEventRow>(
    `
      SELECT
        id::text,
        operation,
        schema_name,
        table_name,
        changed_at,
        old_row,
        new_row
      FROM pg_mcp_live_event_log
      WHERE schema_name = ANY($1::text[])
        AND ($2::text IS NULL OR table_name = $2)
        AND ($3::text IS NULL OR operation = $3)
        AND changed_at >= $4::timestamptz
      ORDER BY changed_at DESC, id DESC
      LIMIT $5;
    `,
    [...params, safeLimit],
  );

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      schemas,
      tableName: options.tableName ?? null,
      operation: options.operation ?? null,
      sinceMinutes: safeSinceMinutes,
      since: since.toISOString(),
      limit: safeLimit,
    },
    totalEvents: Number(totalResult.rows[0]?.total_events ?? 0),
    byTable: byTableResult.rows.map((row) => ({
      schemaName: row.schema_name,
      tableName: row.table_name,
      totalEvents: Number(row.total_events),
      insertCount: Number(row.insert_count),
      updateCount: Number(row.update_count),
      deleteCount: Number(row.delete_count),
      lastChangedAt: row.last_changed_at.toISOString(),
    })),
    byOperation: byOperationResult.rows.map((row) => ({
      operation: row.operation,
      count: Number(row.count),
    })),
    latestEvents: latestEventsResult.rows.map((row) => ({
      id: row.id,
      operation: row.operation,
      schemaName: row.schema_name,
      tableName: row.table_name,
      changedAt: row.changed_at.toISOString(),
      oldRow: row.old_row,
      newRow: row.new_row,
    })),
  };
}
