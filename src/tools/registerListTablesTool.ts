import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { listTables } from "../db/introspection.js";
import { createErrorToolResponse, createSuccessToolResponse } from "./response.js";

export function registerListTablesTool(server: McpServer) {
  server.registerTool(
    "list_tables",
    {
      title: "List Tables",
      description: "List PostgreSQL tables in the allowed schemas, optionally filtered by schema name.",
      inputSchema: z.object({
        schemaName: z.string().min(1).optional(),
      }),
    },
    async ({ schemaName }) => {
      try {
        const tables = await listTables(schemaName);
        return createSuccessToolResponse(
          `Listed ${tables.length} table(s)${schemaName ? ` in schema "${schemaName}"` : ""}.`,
          tables,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return createErrorToolResponse("Failed to list tables.", message);
      }
    },
  );
}
