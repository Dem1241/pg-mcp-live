import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { tailRecentEvents } from "../db/recentEvents.js";
import { createErrorToolResponse, createSuccessToolResponse } from "./response.js";

export function registerTailRecentEventsTool(server: McpServer) {
  server.registerTool(
    "tail_recent_events",
    {
      title: "Tail Recent Events",
      description:
        "Wait for the next matching live event, then return the corresponding recent event-log rows. Requires examples/event-log.sql to be installed.",
      inputSchema: z.object({
        schemaName: z.string().min(1).optional(),
        tableName: z.string().min(1).optional(),
        operation: z.enum(["INSERT", "UPDATE", "DELETE"]).optional(),
        channel: z.string().min(1).default("pg_mcp_live_events"),
        timeoutMs: z.number().int().positive().max(30_000).optional(),
        limit: z.number().int().positive().max(10_000).optional(),
      }),
    },
    async ({ schemaName, tableName, operation, channel, timeoutMs, limit }) => {
      try {
        const result = await tailRecentEvents({
          schemaName,
          tableName,
          operation,
          channel,
          timeoutMs,
          limit,
        });
        return createSuccessToolResponse(
          result.timedOut
            ? `Timed out waiting for matching events on "${result.channel}".`
            : `Received ${result.eventCount} matching event(s) on "${result.channel}".`,
          result,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return createErrorToolResponse("Failed to tail recent events.", message);
      }
    },
  );
}
