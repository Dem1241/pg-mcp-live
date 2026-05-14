import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { getTableSample } from "../db/sampleRows.js";

export function registerGetTableSampleTool(server: McpServer) {
  server.registerTool(
    "get_table_sample",
    {
      title: "Get Table Sample",
      description:
        "Return a small sample of rows from a PostgreSQL table without allowing raw SQL input.",
      inputSchema: z.object({
        schemaName: z.string().min(1).default("public"),
        tableName: z.string().min(1),
        limit: z.number().int().positive().max(1000).optional(),
      }),
    },
    async ({ schemaName, tableName, limit }) => {
      try {
        const sample = await getTableSample(schemaName, tableName, limit);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(sample, null, 2),
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
              text: `Failed to get table sample: ${message}`,
            },
          ],
        };
      }
    },
  );
}
