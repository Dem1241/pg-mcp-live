import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { listEventSources } from "../db/features.js";

export function registerListEventSourcesTool(server: McpServer) {
  server.registerTool(
    "list_event_sources",
    {
      title: "List Event Sources",
      description:
        "List allowed base tables and whether each one currently emits pg-mcp-live notifications.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const eventSources = await listEventSources();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(eventSources, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown event source error";

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Failed to list event sources: ${message}`,
            },
          ],
        };
      }
    },
  );
}
