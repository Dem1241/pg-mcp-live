import { beforeAll, describe, expect, it } from "vitest";

import { checkFeatureSupport, listEventSources } from "../src/db/features.js";
import { waitForNotification } from "../src/db/notifications.js";
import { getRecentEvents, tailRecentEvents } from "../src/db/recentEvents.js";
import { summarizeRecentActivity } from "../src/db/eventActivity.js";
import { ensureDemoDatabaseReady, removeLiveEventsSetup, resetEventLog } from "./helpers/demoDatabase.js";
import { pool } from "../src/db/pool.js";

describe("PostgreSQL live-events integration", () => {
  beforeAll(async () => {
    await ensureDemoDatabaseReady();
  }, 10_000);
  it("reports default feature support before optional setup", async () => {
    await removeLiveEventsSetup();

    const support = await checkFeatureSupport();

    expect(support.databaseConnection.ok).toBe(true);
    expect(support.schemas.allowed).toEqual(["public"]);
    expect(support.eventHistory.installed).toBe(false);
    expect(support.liveNotifications.channel).toBe("pg_mcp_live_events");
    expect(support.liveNotifications.triggerFunctionInstalled).toBe(false);
    expect(support.liveNotifications.triggerCount).toBe(0);
    expect(support.liveNotifications.coveredTables).toEqual([]);
    expect(support.liveNotifications.missingTables).toEqual(
      expect.arrayContaining([
        "public.customers",
        "public.products",
        "public.inventory",
        "public.orders",
        "public.order_items",
      ]),
    );
  });

  it("lists event sources before optional setup", async () => {
    await removeLiveEventsSetup();

    const eventSources = await listEventSources();

    expect(eventSources.channel).toBe("pg_mcp_live_events");
    expect(eventSources.triggerFunctionInstalled).toBe(false);
    expect(eventSources.coveredSourceCount).toBe(0);
    expect(eventSources.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tableName: "public.customers",
          notificationsEnabled: false,
        }),
        expect.objectContaining({
          tableName: "public.inventory",
          notificationsEnabled: false,
        }),
      ]),
    );
  });

  it("summarizes recent table-change activity", async () => {
    await resetEventLog();

    const support = await checkFeatureSupport();

    expect(support.eventHistory.installed).toBe(true);
    expect(support.liveNotifications.triggerFunctionInstalled).toBe(true);
    expect(support.liveNotifications.coveredTables).toEqual(
      expect.arrayContaining([
        "public.customers",
        "public.products",
        "public.inventory",
        "public.orders",
        "public.order_items",
      ]),
    );

    const eventSources = await listEventSources();

    expect(eventSources.coveredSourceCount).toBeGreaterThanOrEqual(5);
    expect(eventSources.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tableName: "public.customers",
          notificationsEnabled: true,
        }),
        expect.objectContaining({
          tableName: "public.order_items",
          notificationsEnabled: true,
        }),
      ]),
    );

    await pool.query(`
      UPDATE inventory
      SET quantity = quantity - 1,
          updated_at = NOW()
      WHERE product_id = 1;
    `);
    await pool.query(`
      UPDATE inventory
      SET quantity = quantity - 1,
          updated_at = NOW()
      WHERE product_id = 1;
    `);

    const summary = await summarizeRecentActivity({
      schemaName: "public",
      tableName: "inventory",
      operation: "UPDATE",
      sinceMinutes: 60,
      limit: 5,
    });

    expect(summary.totalEvents).toBeGreaterThanOrEqual(2);
    expect(summary.byTable).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schemaName: "public",
          tableName: "inventory",
          updateCount: expect.any(Number),
        }),
      ]),
    );
    expect(summary.byOperation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: "UPDATE",
        }),
      ]),
    );
    expect(summary.latestEvents.length).toBeGreaterThan(0);
    expect(summary.latestEvents[0]).toEqual(
      expect.objectContaining({
        operation: "UPDATE",
        schemaName: "public",
        tableName: "inventory",
      }),
    );
  });

  it("stores and returns recent table-change events", async () => {
    await resetEventLog();

    await pool.query(`
      UPDATE inventory
      SET quantity = quantity - 1,
          updated_at = NOW()
      WHERE product_id = 1;
    `);

    const result = await getRecentEvents({
      schemaName: "public",
      tableName: "inventory",
      operation: "UPDATE",
      limit: 5,
    });

    expect(result.eventCount).toBeGreaterThanOrEqual(1);
    expect(result.events[0]).toEqual(
      expect.objectContaining({
        operation: "UPDATE",
        schemaName: "public",
        tableName: "inventory",
      }),
    );
    expect(result.events[0]?.oldRow).toHaveProperty("quantity");
    expect(result.events[0]?.newRow).toHaveProperty("quantity");
  });

  it("waits for a PostgreSQL notification", async () => {
    const channel = "pg_mcp_live_events";
    const payload = {
      event: "inventory_changed",
      productId: 1,
    };

    const waitPromise = waitForNotification(channel, 5_000);

    await new Promise((resolve) => setTimeout(resolve, 100));
    await pool.query("SELECT pg_notify($1, $2)", [channel, JSON.stringify(payload)]);

    const result = await waitPromise;

    expect(result.channel).toBe(channel);
    expect(result.timedOut).toBe(false);
    expect(result.notification?.channel).toBe(channel);
    expect(result.notification?.payload).toBe(JSON.stringify(payload));
    expect(result.notification?.parsedPayload).toEqual(payload);
  });

  it("times out when no PostgreSQL notification arrives", async () => {
    const result = await waitForNotification("pg_mcp_live_events", 150);

    expect(result.channel).toBe("pg_mcp_live_events");
    expect(result.timedOut).toBe(true);
    expect(result.notification).toBeNull();
  });

  it("tails recent events for the next matching table change", async () => {
    await resetEventLog();

    const tailPromise = tailRecentEvents({
      schemaName: "public",
      tableName: "inventory",
      operation: "UPDATE",
      timeoutMs: 5_000,
      limit: 5,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    await pool.query(`
      UPDATE inventory
      SET quantity = quantity - 1,
          updated_at = NOW()
      WHERE product_id = 1;
    `);

    const result = await tailPromise;

    expect(result.timedOut).toBe(false);
    expect(result.channel).toBe("pg_mcp_live_events");
    expect(result.eventCount).toBeGreaterThanOrEqual(1);
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: "UPDATE",
          schemaName: "public",
          tableName: "inventory",
        }),
      ]),
    );
    expect(result.notification?.channel).toBe("pg_mcp_live_events");
  });

  it("keeps waiting past unrelated notifications until a matching event arrives", async () => {
    await resetEventLog();

    const tailPromise = tailRecentEvents({
      schemaName: "public",
      tableName: "inventory",
      operation: "UPDATE",
      timeoutMs: 5_000,
      limit: 5,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    await pool.query(`
      UPDATE products
      SET description = CONCAT(description, ' updated')
      WHERE id = 1;
    `);

    await new Promise((resolve) => setTimeout(resolve, 100));
    await pool.query(`
      UPDATE inventory
      SET quantity = quantity - 1,
          updated_at = NOW()
      WHERE product_id = 1;
    `);

    const result = await tailPromise;

    expect(result.timedOut).toBe(false);
    expect(result.events.every((event) => event.tableName === "inventory")).toBe(true);
    expect(result.events.every((event) => event.operation === "UPDATE")).toBe(true);
  });

  it("times out when no matching tailed event arrives", async () => {
    await resetEventLog();

    const result = await tailRecentEvents({
      schemaName: "public",
      tableName: "inventory",
      operation: "DELETE",
      timeoutMs: 150,
      limit: 5,
    });

    expect(result.channel).toBe("pg_mcp_live_events");
    expect(result.timedOut).toBe(true);
    expect(result.eventCount).toBe(0);
    expect(result.events).toEqual([]);
    expect(result.notification).toBeNull();
  });
});
