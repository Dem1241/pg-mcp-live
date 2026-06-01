import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();

vi.mock("../src/db/pool.js", () => ({
  pool: {
    query: queryMock,
  },
}));

beforeEach(() => {
  queryMock.mockReset();
});

describe("assertEventLogAvailable", () => {
  it("throws a setup error when the event log table is missing", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ exists: false }],
    });

    const { assertEventLogAvailable } = await import("../src/db/features.js");

    await expect(assertEventLogAvailable()).rejects.toThrow(
      "Live event history is not installed. Run examples/event-log.sql to create pg_mcp_live_event_log.",
    );
  });

  it("returns when the event log table exists", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ exists: true }],
    });

    const { assertEventLogAvailable } = await import("../src/db/features.js");

    await expect(assertEventLogAvailable()).resolves.toBeUndefined();
  });
});

describe("checkFeatureSupport", () => {
  it("reports installed and missing live features from database state", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({
        rows: [
          { schema_name: "public", table_name: "customers" },
          { schema_name: "public", table_name: "products" },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ qualified_table_name: "public.customers", trigger_count: "1" }],
      });

    const { checkFeatureSupport } = await import("../src/db/features.js");

    await expect(checkFeatureSupport()).resolves.toEqual({
      databaseConnection: {
        ok: true,
      },
      schemas: {
        allowed: ["public"],
      },
      eventHistory: {
        installed: true,
        tableName: "pg_mcp_live_event_log",
        setupSql: "examples/event-log.sql",
      },
      liveNotifications: {
        channel: "pg_mcp_live_events",
        triggerFunctionInstalled: true,
        triggerCount: 1,
        coveredTables: ["public.customers"],
        missingTables: ["public.products"],
        setupSql: "examples/live-events.sql",
      },
    });
  });
});

describe("formatStartupDiagnostics", () => {
  it("formats a readable startup summary", async () => {
    const { formatStartupDiagnostics } = await import("../src/db/features.js");

    expect(
      formatStartupDiagnostics({
        databaseConnection: {
          ok: true,
        },
        schemas: {
          allowed: ["public"],
        },
        eventHistory: {
          installed: false,
          tableName: "pg_mcp_live_event_log",
          setupSql: "examples/event-log.sql",
        },
        liveNotifications: {
          channel: "pg_mcp_live_events",
          triggerFunctionInstalled: false,
          triggerCount: 0,
          coveredTables: [],
          missingTables: ["public.customers", "public.products"],
          setupSql: "examples/live-events.sql",
        },
      }).lines,
    ).toEqual([
      "Database connection: ok",
      "Allowed schemas: public",
      "Event history: missing (examples/event-log.sql)",
      "Live notifications: missing (examples/live-events.sql)",
      "Tables without notification triggers: public.customers, public.products",
    ]);
  });
});
