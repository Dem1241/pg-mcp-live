import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { getRecentEvents } from "../db/recentEvents.js";

export function registerGetRecentEventsTool(server: McpServer) {
  server.registerTool(
    "get_recent_events",
    {
      title: "Get Recent Events",
      description:
        "Return recent PostgreSQL table-change events from the pg-mcp-live event log.",
      inputSchema: z.object({
        schemaName: z.string().min(1).optional(),
        tableName: z.string().min(1).optional(),
        operation: z.enum(["INSERT", "UPDATE", "DELETE"]).optional(),
        limit: z.number().int().positive().max(10_000).optional(),
      }),
    },
    async ({ schemaName, tableName, operation, limit }) => {
      try {
        const result = await getRecentEvents({
          schemaName,
          tableName,
          operation,
          limit,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Failed to get recent events: ${message}`,
            },
          ],
        };
      }
    },
  );
}
