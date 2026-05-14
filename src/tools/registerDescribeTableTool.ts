import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { describeTable } from "../db/introspection.js";

export function registerDescribeTableTool(server: McpServer) {
  server.registerTool(
    "describe_table",
    {
      title: "Describe Table",
      description:
        "Describe a PostgreSQL table, including columns, primary key columns, and foreign key relationships.",
      inputSchema: z.object({
        schemaName: z.string().min(1).default("public"),
        tableName: z.string().min(1),
      }),
    },
    async ({ schemaName, tableName }) => {
      try {
        const tableDescription = await describeTable(schemaName, tableName);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(tableDescription, null, 2),
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
              text: `Failed to describe table: ${message}`,
            },
          ],
        };
      }
    },
  );
}
