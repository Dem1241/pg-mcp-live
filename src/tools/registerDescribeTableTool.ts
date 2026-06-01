import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { describeTable } from "../db/introspection.js";
import { createErrorToolResponse, createSuccessToolResponse } from "./response.js";

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
        return createSuccessToolResponse(
          `Described table "${schemaName}.${tableName}" with ${tableDescription.columns.length} column(s).`,
          tableDescription,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return createErrorToolResponse(`Failed to describe table "${schemaName}.${tableName}".`, message);
      }
    },
  );
}
