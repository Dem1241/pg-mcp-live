import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { SERVER_VERSION } from "../version.js";

export function createMcpServer() {
  const server = new McpServer({
    name: "pg-mcp-live",
    version: SERVER_VERSION,
  });

  return server;
}
