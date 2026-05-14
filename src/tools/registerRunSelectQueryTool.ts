import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { runSafeSelectQuery } from "../db/safeQuery.js";

export function registerRunSelectQueryTool(server: McpServer) {
  server.registerTool(
    "run_select_query",
    {
      title: "Run SELECT Query",
      description:
        "Run a safe read-only SELECT query against PostgreSQL. Dangerous SQL keywords, multiple statements, and write operations are blocked.",
      inputSchema: z.object({
        sql: z.string().min(1),
        limit: z.number().int().positive().max(10_000).optional(),
      }),
    },
    async ({ sql, limit }) => {
      try {
        const result = await runSafeSelectQuery(sql, limit);

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
              text: `Query rejected or failed: ${message}`,
            },
          ],
        };
      }
    },
  );
}
