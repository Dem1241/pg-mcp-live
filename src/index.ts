import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { checkFeatureSupport, formatStartupDiagnostics } from "./db/features.js";
import { closePool } from "./db/pool.js";
import { registerPostgresResources } from "./resources/registerPostgresResources.js";
import { createMcpServer } from "./server/createMcpServer.js";
import { registerCheckDatabaseConnectionTool } from "./tools/registerCheckDatabaseConnectionTool.js";
import { registerCheckFeatureSupportTool } from "./tools/registerCheckFeatureSupportTool.js";
import { registerDescribeTableTool } from "./tools/registerDescribeTableTool.js";
import { registerExplainQueryTool } from "./tools/registerExplainQueryTool.js";
import { registerGetTableSampleTool } from "./tools/registerGetTableSampleTool.js";
import { registerGetRecentEventsTool } from "./tools/registerGetRecentEventsTool.js";
import { registerListSchemasTool } from "./tools/registerListSchemasTool.js";
import { registerListEventSourcesTool } from "./tools/registerListEventSourcesTool.js";
import { registerListTablesTool } from "./tools/registerListTablesTool.js";
import { registerPingTool } from "./tools/registerPingTool.js";
import { registerRunSelectQueryTool } from "./tools/registerRunSelectQueryTool.js";
import { registerSummarizeRelationshipsTool } from "./tools/registerSummarizeRelationshipsTool.js";
import { registerSummarizeRecentActivityTool } from "./tools/registerSummarizeRecentActivityTool.js";
import { registerTailRecentEventsTool } from "./tools/registerTailRecentEventsTool.js";
import { registerWaitForNotificationTool } from "./tools/registerWaitForNotificationTool.js";

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

async function logStartupDiagnostics() {
  try {
    const featureSupport = await checkFeatureSupport();
    const diagnostics = formatStartupDiagnostics(featureSupport);

    console.error("pg-mcp-live startup diagnostics:");

    for (const line of diagnostics.lines) {
      console.error(`- ${line}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown startup diagnostics error";
    console.error(`pg-mcp-live startup diagnostics unavailable: ${message}`);
  }
}

async function main() {
  setupShutdownHandlers();

  const server = createMcpServer();

  registerPingTool(server);
  registerCheckDatabaseConnectionTool(server);
  registerCheckFeatureSupportTool(server);
  registerListEventSourcesTool(server);
  registerListSchemasTool(server);
  registerListTablesTool(server);
  registerDescribeTableTool(server);
  registerGetTableSampleTool(server);
  registerGetRecentEventsTool(server);
  registerRunSelectQueryTool(server);
  registerExplainQueryTool(server);
  registerSummarizeRelationshipsTool(server);
  registerSummarizeRecentActivityTool(server);
  registerTailRecentEventsTool(server);
  registerWaitForNotificationTool(server);

  registerPostgresResources(server);

  const transport = new StdioServerTransport();

  console.error("pg-mcp-live MCP server starting on stdio...");
  await logStartupDiagnostics();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error("Fatal error while starting pg-mcp-live:", error);
  process.exit(1);
});
