import { assertSafeIdentifier } from "../security/identifiers.js";
import { assertEventLogAvailable } from "./features.js";
import { getAllowedSchemas, normalizeLimit } from "./guards.js";
import { pool } from "./pool.js";

export type EventOperation = "INSERT" | "UPDATE" | "DELETE";

export type RecentEvent = {
  id: string;
  operation: EventOperation;
  schemaName: string;
  tableName: string;
  changedAt: string;
  oldRow: Record<string, unknown> | null;
  newRow: Record<string, unknown> | null;
};

export type GetRecentEventsOptions = {
  schemaName?: string;
  tableName?: string;
  operation?: EventOperation;
  limit?: number;
};

export type GetRecentEventsResult = {
  limit: number;
  filters: {
    schemas: string[];
    tableName: string | null;
    operation: EventOperation | null;
  };
  eventCount: number;
  events: RecentEvent[];
};

type EventLogRow = {
  id: string;
  operation: EventOperation;
  schema_name: string;
  table_name: string;
  changed_at: Date;
  old_row: Record<string, unknown> | null;
  new_row: Record<string, unknown> | null;
};

export async function getRecentEvents(
  options: GetRecentEventsOptions = {},
): Promise<GetRecentEventsResult> {
  await assertEventLogAvailable();

  const safeLimit = normalizeLimit(options.limit, 20);

  if (options.tableName) {
    assertSafeIdentifier(options.tableName, "table name");
  }

  const schemas = getAllowedSchemas(options.schemaName);

  const result = await pool.query<EventLogRow>(
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
      ORDER BY changed_at DESC, id DESC
      LIMIT $4;
    `,
    [schemas, options.tableName ?? null, options.operation ?? null, safeLimit],
  );

  const events = result.rows.map((row) => ({
    id: row.id,
    operation: row.operation,
    schemaName: row.schema_name,
    tableName: row.table_name,
    changedAt: row.changed_at.toISOString(),
    oldRow: row.old_row,
    newRow: row.new_row,
  }));

  return {
    limit: safeLimit,
    filters: {
      schemas,
      tableName: options.tableName ?? null,
      operation: options.operation ?? null,
    },
    eventCount: events.length,
    events,
  };
}
