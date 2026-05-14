import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { closePool } from "./db/pool.js";
import { createMcpServer } from "./server/createMcpServer.js";
import { registerCheckDatabaseConnectionTool } from "./tools/registerCheckDatabaseConnectionTool.js";
import { registerDescribeTableTool } from "./tools/registerDescribeTableTool.js";
import { registerGetTableSampleTool } from "./tools/registerGetTableSampleTool.js";
import { registerListSchemasTool } from "./tools/registerListSchemasTool.js";
import { registerListTablesTool } from "./tools/registerListTablesTool.js";
import { registerPingTool } from "./tools/registerPingTool.js";
import { registerRunSelectQueryTool } from "./tools/registerRunSelectQueryTool.js";

function setupShutdownHandlers() {
  const shutdown = async (signal: string) => {
    console.error(`Received ${signal}. Shutting down pg-mcp-live...`);

    try {
      await closePool();
      console.error("PostgreSQL pool closed.");
    } catch (error) {
      console.error("Error while closing PostgreSQL pool:", error);
    }

    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

async function main() {
  setupShutdownHandlers();

  const server = createMcpServer();

  registerPingTool(server);
  registerCheckDatabaseConnectionTool(server);
  registerListSchemasTool(server);
  registerListTablesTool(server);
  registerDescribeTableTool(server);
  registerGetTableSampleTool(server);
  registerRunSelectQueryTool(server);

  const transport = new StdioServerTransport();

  console.error("pg-mcp-live MCP server starting on stdio...");
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error("Fatal error while starting pg-mcp-live:", error);
  process.exit(1);
});
