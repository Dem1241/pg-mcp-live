import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { listEventSources } from "../db/features.js";
import { createErrorToolResponse, createSuccessToolResponse } from "./response.js";

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
        return createSuccessToolResponse(
          `Checked notification coverage for ${eventSources.sources.length} event source(s).`,
          eventSources,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown event source error";
        return createErrorToolResponse("Failed to list event sources.", message);
      }
    },
  );
}
