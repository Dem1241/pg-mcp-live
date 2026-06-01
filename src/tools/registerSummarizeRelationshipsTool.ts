import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { summarizeRelationships } from "../db/relationships.js";
import { createErrorToolResponse, createSuccessToolResponse } from "./response.js";

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
        return createSuccessToolResponse(
          `Summarized ${summary.relationshipCount} relationship(s) across ${summary.schemas.length} schema(s).`,
          summary,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return createErrorToolResponse("Failed to summarize relationships.", message);
      }
    },
  );
}
