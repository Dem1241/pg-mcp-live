import { describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();

vi.mock("../src/db/pool.js", () => ({
  pool: {
    query: queryMock,
  },
}));

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
