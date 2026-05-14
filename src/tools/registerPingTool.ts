import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPingTool(server: McpServer) {
  server.registerTool(
    "ping",
    {
      title: "Ping",
      description: "Check whether the pg-mcp-live MCP server is running.",
      inputSchema: z.object({}),
    },
    async () => {
      return {
        content: [
          {
            type: "text" as const,
            text: "pong",
          },
        ],
      };
    },
  );
}
