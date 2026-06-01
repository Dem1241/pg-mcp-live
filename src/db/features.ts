import { pool } from "./pool.js";

type FeaturePresenceRow = {
  exists: boolean;
};

const EVENT_LOG_SETUP_ERROR =
  "Live event history is not installed. Run examples/event-log.sql to create pg_mcp_live_event_log.";

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
