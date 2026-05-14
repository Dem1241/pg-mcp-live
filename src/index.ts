import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createMcpServer } from "./server/createMcpServer.js";
import { registerPingTool } from "./tools/registerPingTool.js";

async function main() {
  const server = createMcpServer();

  registerPingTool(server);

  const transport = new StdioServerTransport();

  console.error("pg-mcp-live MCP server starting on stdio...");
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error("Fatal error while starting pg-mcp-live:", error);
  process.exit(1);
});
