import type { PoolClient } from "pg";

import { assertSafeIdentifier, quoteIdentifier } from "../security/identifiers.js";
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

export type TailRecentEventsOptions = GetRecentEventsOptions & {
  channel?: string;
  timeoutMs?: number;
};

export type TailRecentEventsResult = {
  channel: string;
  timeoutMs: number;
  timedOut: boolean;
  limit: number;
  filters: {
    schemas: string[];
    tableName: string | null;
    operation: EventOperation | null;
  };
  eventCount: number;
  events: RecentEvent[];
  notification: {
    channel: string;
    payload: string | null;
    parsedPayload: unknown | null;
    processId: number;
    receivedAt: string;
  } | null;
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

type EventQueryRunner = {
  query: PoolClient["query"];
};

type TailNotification = {
  channel: string;
  payload?: string;
  processId: number;
};

type TailNotificationResult = {
  channel: string;
  payload: string | null;
  parsedPayload: unknown | null;
  processId: number;
  receivedAt: string;
};

type EventLogCursorRow = {
  max_id: string | number | null;
};

function normalizeTimeoutMs(timeoutMs: number | undefined) {
  if (timeoutMs === undefined) {
    return 10_000;
  }

  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("timeoutMs must be a positive integer.");
  }

  return Math.min(timeoutMs, 30_000);
}

function parseNotificationPayload(payload: string | undefined): unknown | null {
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function mapRecentEvent(row: EventLogRow): RecentEvent {
  return {
    id: row.id,
    operation: row.operation,
    schemaName: row.schema_name,
    tableName: row.table_name,
    changedAt: row.changed_at.toISOString(),
    oldRow: row.old_row,
    newRow: row.new_row,
  };
}

async function queryRecentEventRows(
  client: EventQueryRunner,
  options: GetRecentEventsOptions,
  schemas: string[],
  safeLimit: number,
  order: "ASC" | "DESC",
  afterId?: number,
) {
  return client.query<EventLogRow>(
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
        AND ($4::bigint IS NULL OR id > $4)
      ORDER BY changed_at ${order}, id ${order}
      LIMIT $5;
    `,
    [schemas, options.tableName ?? null, options.operation ?? null, afterId ?? null, safeLimit],
  );
}

async function getLatestEventId(client: PoolClient) {
  const result = await client.query<EventLogCursorRow>(
    `
      SELECT MAX(id) AS max_id
      FROM pg_mcp_live_event_log;
    `,
  );

  return Number(result.rows[0]?.max_id ?? 0);
}

async function waitForTailNotification(
  client: PoolClient,
  channel: string,
  timeoutMs: number,
) {
  let timeout: NodeJS.Timeout | undefined;
  let handler: ((message: TailNotification) => void) | undefined;

  try {
    return await new Promise<TailNotificationResult | null>((resolve) => {
      let settled = false;

      const settle = (value: TailNotificationResult | null) => {
        if (settled) {
          return;
        }

        settled = true;

        if (timeout) {
          clearTimeout(timeout);
        }

        if (handler) {
          client.off("notification", handler);
        }

        resolve(value);
      };

      handler = (message: TailNotification) => {
        if (message.channel !== channel) {
          return;
        }

        settle({
          channel: message.channel,
          payload: message.payload ?? null,
          parsedPayload: parseNotificationPayload(message.payload),
          processId: message.processId,
          receivedAt: new Date().toISOString(),
        });
      };

      client.on("notification", handler);

      timeout = setTimeout(() => {
        settle(null);
      }, timeoutMs);
    });
  } finally {
    if (handler) {
      client.off("notification", handler);
    }

    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function getRecentEvents(
  options: GetRecentEventsOptions = {},
): Promise<GetRecentEventsResult> {
  await assertEventLogAvailable();

  const safeLimit = normalizeLimit(options.limit, 20);

  if (options.tableName) {
    assertSafeIdentifier(options.tableName, "table name");
  }

  const schemas = getAllowedSchemas(options.schemaName);
  const result = await queryRecentEventRows(pool, options, schemas, safeLimit, "DESC");
  const events = result.rows.map(mapRecentEvent);

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

export async function tailRecentEvents(
  options: TailRecentEventsOptions = {},
): Promise<TailRecentEventsResult> {
  await assertEventLogAvailable();

  const safeLimit = normalizeLimit(options.limit, 10);
  const safeTimeoutMs = normalizeTimeoutMs(options.timeoutMs);
  const channel = options.channel ?? "pg_mcp_live_events";

  assertSafeIdentifier(channel, "notification channel");

  if (options.tableName) {
    assertSafeIdentifier(options.tableName, "table name");
  }

  const schemas = getAllowedSchemas(options.schemaName);
  const client = await pool.connect();
  const quotedChannel = quoteIdentifier(channel);

  try {
    await client.query(`LISTEN ${quotedChannel}`);

    let lastSeenEventId = await getLatestEventId(client);
    const deadline = Date.now() + safeTimeoutMs;

    while (true) {
      const remainingTimeoutMs = Math.max(0, deadline - Date.now());

      if (remainingTimeoutMs === 0) {
        return {
          channel,
          timeoutMs: safeTimeoutMs,
          timedOut: true,
          limit: safeLimit,
          filters: {
            schemas,
            tableName: options.tableName ?? null,
            operation: options.operation ?? null,
          },
          eventCount: 0,
          events: [],
          notification: null,
        };
      }

      const notification = await waitForTailNotification(client, channel, remainingTimeoutMs);

      if (!notification) {
        return {
          channel,
          timeoutMs: safeTimeoutMs,
          timedOut: true,
          limit: safeLimit,
          filters: {
            schemas,
            tableName: options.tableName ?? null,
            operation: options.operation ?? null,
          },
          eventCount: 0,
          events: [],
          notification: null,
        };
      }

      const result = await queryRecentEventRows(
        client,
        options,
        schemas,
        safeLimit,
        "ASC",
        lastSeenEventId,
      );
      const events = result.rows.map(mapRecentEvent);

      if (result.rows.length > 0) {
        lastSeenEventId = Math.max(lastSeenEventId, ...result.rows.map((row) => Number(row.id)));
      } else {
        const parsedPayload = notification.parsedPayload;

        if (
          parsedPayload &&
          typeof parsedPayload === "object" &&
          "eventId" in parsedPayload &&
          typeof parsedPayload.eventId === "number"
        ) {
          lastSeenEventId = Math.max(lastSeenEventId, parsedPayload.eventId);
        }
      }

      if (events.length > 0) {
        return {
          channel,
          timeoutMs: safeTimeoutMs,
          timedOut: false,
          limit: safeLimit,
          filters: {
            schemas,
            tableName: options.tableName ?? null,
            operation: options.operation ?? null,
          },
          eventCount: events.length,
          events,
          notification,
        };
      }
    }
  } finally {
    await client.query(`UNLISTEN ${quotedChannel}`).catch(() => undefined);
    client.release();
  }
}
