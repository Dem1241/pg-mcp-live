import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { listSchemas } from "../db/introspection.js";

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

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(schemas, null, 2),
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
              text: `Failed to list schemas: ${message}`,
            },
          ],
        };
      }
    },
  );
}
