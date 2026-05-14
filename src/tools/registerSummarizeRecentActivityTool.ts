import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { summarizeRecentActivity } from "../db/eventActivity.js";

export function registerSummarizeRecentActivityTool(server: McpServer) {
  server.registerTool(
    "summarize_recent_activity",
    {
      title: "Summarize Recent Activity",
      description:
        "Summarize recent PostgreSQL table-change events by table, operation, and latest event.",
      inputSchema: z.object({
        schemaName: z.string().min(1).optional(),
        tableName: z.string().min(1).optional(),
        operation: z.enum(["INSERT", "UPDATE", "DELETE"]).optional(),
        sinceMinutes: z.number().int().positive().max(60 * 24 * 30).optional(),
        limit: z.number().int().positive().max(10_000).optional(),
      }),
    },
    async ({ schemaName, tableName, operation, sinceMinutes, limit }) => {
      try {
        const result = await summarizeRecentActivity({
          schemaName,
          tableName,
          operation,
          sinceMinutes,
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
              text: `Failed to summarize recent activity: ${message}`,
            },
          ],
        };
      }
    },
  );
}
