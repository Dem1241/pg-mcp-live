import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { runSafeSelectQuery } from "../db/safeQuery.js";
import { createErrorToolResponse, createSuccessToolResponse } from "./response.js";

export function registerRunSelectQueryTool(server: McpServer) {
  server.registerTool(
    "run_select_query",
    {
      title: "Run SELECT Query",
      description:
        "Run a safe read-only SELECT query against PostgreSQL. Dangerous SQL keywords, multiple statements, and write operations are blocked.",
      inputSchema: z.object({
        sql: z.string().min(1),
        limit: z.number().int().positive().max(10_000).optional(),
      }),
    },
    async ({ sql, limit }) => {
      try {
        const result = await runSafeSelectQuery(sql, limit);
        return createSuccessToolResponse(
          `Executed guarded SELECT query and returned ${result.rowCount} row(s).`,
          result,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return createErrorToolResponse("Query rejected or failed.", message);
      }
    },
  );
}
