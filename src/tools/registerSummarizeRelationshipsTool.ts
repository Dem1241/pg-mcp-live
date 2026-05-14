import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { summarizeRelationships } from "../db/relationships.js";

export function registerSummarizeRelationshipsTool(server: McpServer) {
  server.registerTool(
    "summarize_relationships",
    {
      title: "Summarize Relationships",
      description:
        "Return a compact relationship map for foreign keys in the exposed PostgreSQL schemas.",
      inputSchema: z.object({
        schemaName: z.string().min(1).optional(),
      }),
    },
    async ({ schemaName }) => {
      try {
        const summary = await summarizeRelationships(schemaName);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(summary, null, 2),
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
              text: `Failed to summarize relationships: ${message}`,
            },
          ],
        };
      }
    },
  );
}
