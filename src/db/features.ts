import { env } from "../config/env.js";
import { pool } from "./pool.js";

type FeaturePresenceRow = {
  exists: boolean;
};

type TriggerCountRow = {
  trigger_count: string | number;
};

export type FeatureSupport = {
  databaseConnection: {
    ok: boolean;
  };
  schemas: {
    allowed: string[];
  };
  eventHistory: {
    installed: boolean;
    tableName: string;
    setupSql: string;
  };
  liveNotifications: {
    channel: string;
    triggerFunctionInstalled: boolean;
    triggerCount: number;
    coveredTables: string[];
    missingTables: string[];
    setupSql: string;
  };
};

export type StartupDiagnosticsSummary = {
  lines: string[];
};

export type EventSource = {
  tableName: string;
  notificationsEnabled: boolean;
};

export type EventSourceSummary = {
  channel: string;
  triggerFunctionInstalled: boolean;
  coveredSourceCount: number;
  missingSourceCount: number;
  setupSql: string;
  sources: EventSource[];
};

const EVENT_LOG_SETUP_ERROR =
  "Live event history is not installed. Run examples/event-log.sql to create pg_mcp_live_event_log.";

const NOTIFICATION_CHANNEL = "pg_mcp_live_events";
const LIVE_EVENTS_SETUP_SQL = "examples/live-events.sql";
const EVENT_LOG_SETUP_SQL = "examples/event-log.sql";
const NOTIFY_FUNCTION_NAME = "notify_pg_mcp_live_table_change";

export async function assertEventLogAvailable() {
  const result = await pool.query<FeaturePresenceRow>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'pg_mcp_live_event_log'
      ) AS exists;
    `,
  );

  if (!result.rows[0]?.exists) {
    throw new Error(EVENT_LOG_SETUP_ERROR);
  }
}

async function checkDatabaseConnection() {
  await pool.query("SELECT 1");
}

async function getEventLogInstalled() {
  const result = await pool.query<FeaturePresenceRow>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'pg_mcp_live_event_log'
      ) AS exists;
    `,
  );

  return result.rows[0]?.exists === true;
}

async function getTriggerFunctionInstalled() {
  const result = await pool.query<FeaturePresenceRow>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.routines
        WHERE routine_schema = current_schema()
          AND routine_name = $1
      ) AS exists;
    `,
    [NOTIFY_FUNCTION_NAME],
  );

  return result.rows[0]?.exists === true;
}

async function getAllowedBaseTables() {
  const result = await pool.query<{ schema_name: string; table_name: string }>(
    `
      SELECT
        table_schema AS schema_name,
        table_name
      FROM information_schema.tables
      WHERE table_schema = ANY($1::text[])
        AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name;
    `,
    [env.PG_MCP_ALLOWED_SCHEMAS],
  );

  return result.rows.map((row) => `${row.schema_name}.${row.table_name}`);
}

async function getNotificationTriggerCoverage() {
  const result = await pool.query<TriggerCountRow & { qualified_table_name: string }>(
    `
      SELECT
        CONCAT(trigger_schema.nspname, '.', trigger_table.relname) AS qualified_table_name,
        COUNT(*) AS trigger_count
      FROM pg_trigger trigger_info
      JOIN pg_class trigger_table
        ON trigger_table.oid = trigger_info.tgrelid
      JOIN pg_namespace trigger_schema
        ON trigger_schema.oid = trigger_table.relnamespace
      JOIN pg_proc trigger_function
        ON trigger_function.oid = trigger_info.tgfoid
      JOIN pg_namespace function_schema
        ON function_schema.oid = trigger_function.pronamespace
      WHERE NOT trigger_info.tgisinternal
        AND trigger_function.proname = $1
        AND function_schema.nspname = current_schema()
        AND trigger_schema.nspname = ANY($2::text[])
      GROUP BY qualified_table_name
      ORDER BY qualified_table_name;
    `,
    [NOTIFY_FUNCTION_NAME, env.PG_MCP_ALLOWED_SCHEMAS],
  );

  return result.rows.map((row) => ({
    qualifiedTableName: row.qualified_table_name,
    triggerCount: Number(row.trigger_count),
  }));
}

export async function checkFeatureSupport(): Promise<FeatureSupport> {
  await checkDatabaseConnection();

  const [eventLogInstalled, triggerFunctionInstalled, allowedTables, triggerCoverage] =
    await Promise.all([
      getEventLogInstalled(),
      getTriggerFunctionInstalled(),
      getAllowedBaseTables(),
      getNotificationTriggerCoverage(),
    ]);

  const coveredTables = triggerCoverage.map((row) => row.qualifiedTableName);
  const missingTables = allowedTables.filter((tableName) => !coveredTables.includes(tableName));

  return {
    databaseConnection: {
      ok: true,
    },
    schemas: {
      allowed: env.PG_MCP_ALLOWED_SCHEMAS,
    },
    eventHistory: {
      installed: eventLogInstalled,
      tableName: "pg_mcp_live_event_log",
      setupSql: EVENT_LOG_SETUP_SQL,
    },
    liveNotifications: {
      channel: NOTIFICATION_CHANNEL,
      triggerFunctionInstalled,
      triggerCount: triggerCoverage.reduce((sum, row) => sum + row.triggerCount, 0),
      coveredTables,
      missingTables,
      setupSql: LIVE_EVENTS_SETUP_SQL,
    },
  };
}

export function formatStartupDiagnostics(featureSupport: FeatureSupport): StartupDiagnosticsSummary {
  const { schemas, eventHistory, liveNotifications } = featureSupport;

  const lines = [
    `Database connection: ok`,
    `Allowed schemas: ${schemas.allowed.join(", ") || "(none)"}`,
    `Event history: ${eventHistory.installed ? "installed" : `missing (${eventHistory.setupSql})`}`,
    `Live notifications: ${
      liveNotifications.triggerFunctionInstalled
        ? `installed on ${liveNotifications.coveredTables.length} table(s)`
        : `missing (${liveNotifications.setupSql})`
    }`,
  ];

  if (liveNotifications.missingTables.length > 0) {
    lines.push(`Tables without notification triggers: ${liveNotifications.missingTables.join(", ")}`);
  }

  return { lines };
}

export async function listEventSources(): Promise<EventSourceSummary> {
  const featureSupport = await checkFeatureSupport();
  const coveredTables = new Set(featureSupport.liveNotifications.coveredTables);
  const sourceTableNames = [
    ...featureSupport.liveNotifications.coveredTables,
    ...featureSupport.liveNotifications.missingTables,
  ].sort((left, right) => left.localeCompare(right));

  return {
    channel: featureSupport.liveNotifications.channel,
    triggerFunctionInstalled: featureSupport.liveNotifications.triggerFunctionInstalled,
    coveredSourceCount: featureSupport.liveNotifications.coveredTables.length,
    missingSourceCount: featureSupport.liveNotifications.missingTables.length,
    setupSql: featureSupport.liveNotifications.setupSql,
    sources: sourceTableNames.map((tableName) => ({
      tableName,
      notificationsEnabled: coveredTables.has(tableName),
    })),
  };
}
