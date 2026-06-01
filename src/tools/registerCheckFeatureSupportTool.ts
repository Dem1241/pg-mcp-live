import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { checkFeatureSupport } from "../db/features.js";
import { createErrorToolResponse, createSuccessToolResponse } from "./response.js";

export function registerCheckFeatureSupportTool(server: McpServer) {
  server.registerTool(
    "check_feature_support",
    {
      title: "Check Feature Support",
      description:
        "Report which optional pg-mcp-live database features are installed, including event history and live notification triggers.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const featureSupport = await checkFeatureSupport();
        return createSuccessToolResponse(
          `Feature support checked for ${featureSupport.schemas.allowed.length} allowed schema(s).`,
          featureSupport,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown feature detection error";
        return createErrorToolResponse("Feature support check failed.", message);
      }
    },
  );
}
