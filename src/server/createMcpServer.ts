import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function createMcpServer() {
  const server = new McpServer({
    name: "pg-mcp-live",
    version: "0.1.0",
  });

  return server;
}
