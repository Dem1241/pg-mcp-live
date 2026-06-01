import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { checkFeatureSupport } from "../db/features.js";

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

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(featureSupport, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown feature detection error";

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Feature support check failed: ${message}`,
            },
          ],
        };
      }
    },
  );
}
