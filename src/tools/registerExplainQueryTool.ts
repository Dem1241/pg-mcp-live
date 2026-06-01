import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { explainSafeSelectQuery } from "../db/explainQuery.js";
import { createErrorToolResponse, createSuccessToolResponse } from "./response.js";

export function registerExplainQueryTool(server: McpServer) {
  server.registerTool(
    "explain_query",
    {
      title: "Explain Query",
      description:
        "Return a PostgreSQL EXPLAIN plan for a safe read-only SELECT query. This does not use EXPLAIN ANALYZE, so the query is planned but not executed.",
      inputSchema: z.object({
        sql: z.string().min(1),
        limit: z.number().int().positive().max(10_000).optional(),
      }),
    },
    async ({ sql, limit }) => {
      try {
        const result = await explainSafeSelectQuery(sql, limit);
        return createSuccessToolResponse(
          `Generated EXPLAIN plan for a guarded query with row limit ${result.limit}.`,
          result,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return createErrorToolResponse("Query explanation rejected or failed.", message);
      }
    },
  );
}
