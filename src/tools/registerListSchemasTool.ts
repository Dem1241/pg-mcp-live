import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { listSchemas } from "../db/introspection.js";
import { createErrorToolResponse, createSuccessToolResponse } from "./response.js";

export function registerListSchemasTool(server: McpServer) {
  server.registerTool(
    "list_schemas",
    {
      title: "List Schemas",
      description: "List PostgreSQL schemas that pg-mcp-live is allowed to expose.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const schemas = await listSchemas();
        return createSuccessToolResponse(`Listed ${schemas.length} allowed schema(s).`, schemas);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return createErrorToolResponse("Failed to list schemas.", message);
      }
    },
  );
}
