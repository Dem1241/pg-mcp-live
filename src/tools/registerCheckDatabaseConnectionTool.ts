import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { checkDatabaseHealth } from "../db/health.js";

export function registerCheckDatabaseConnectionTool(server: McpServer) {
  server.registerTool(
    "check_database_connection",
    {
      title: "Check Database Connection",
      description: "Check whether pg-mcp-live can connect to the configured PostgreSQL database.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const health = await checkDatabaseHealth();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(health, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown database connection error";

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Database connection failed: ${message}`,
            },
          ],
        };
      }
    },
  );
}
