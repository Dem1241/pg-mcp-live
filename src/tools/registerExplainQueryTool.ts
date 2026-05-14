import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { explainSafeSelectQuery } from "../db/explainQuery.js";

export function registerExplainQueryTool(server: McpServer) {
  server.registerTool(
    "explain_query",
    {
      title: "Explain Query",
      description:
        "Return a PostgreSQL EXPLAIN plan for a safe read-only SELECT query. This does not use EXPLAIN ANALYZE, so the query is planned but not executed.",
      inputSchema: z.object({
        sql: z.string().min(1),
        limit: z.number().int().positive().max(10_000).optional(),
      }),
    },
    async ({ sql, limit }) => {
      try {
        const result = await explainSafeSelectQuery(sql, limit);

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
              text: `Query explanation rejected or failed: ${message}`,
            },
          ],
        };
      }
    },
  );
}
