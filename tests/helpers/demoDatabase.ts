import { readFile } from "node:fs/promises";

import { checkDatabaseHealth } from "../../src/db/health.js";
import { closePool, pool } from "../../src/db/pool.js";

let removeLiveEventsSql: string | null = null;
let eventLogSql: string | null = null;

export async function ensureDemoDatabaseReady() {
  await checkDatabaseHealth();

  if (!removeLiveEventsSql) {
    removeLiveEventsSql = await readFile(
      new URL("../../examples/remove-live-events.sql", import.meta.url),
      "utf8",
    );
  }

  if (!eventLogSql) {
    eventLogSql = await readFile(
      new URL("../../examples/event-log.sql", import.meta.url),
      "utf8",
    );
  }
}

export async function removeLiveEventsSetup() {
  if (!removeLiveEventsSql) {
    await ensureDemoDatabaseReady();
  }

  await pool.query(removeLiveEventsSql!);
}

export async function installEventLogSetup() {
  if (!eventLogSql) {
    await ensureDemoDatabaseReady();
  }

  await pool.query(eventLogSql!);
}

export async function resetEventLog() {
  await installEventLogSetup();
  await pool.query("TRUNCATE TABLE pg_mcp_live_event_log RESTART IDENTITY");
  await pool.query(`
    UPDATE inventory
    SET quantity = 25,
        updated_at = NOW()
    WHERE product_id = 1;
  `);
  await pool.query("TRUNCATE TABLE pg_mcp_live_event_log RESTART IDENTITY");
}

export async function closeDemoDatabase() {
  await closePool();
}
