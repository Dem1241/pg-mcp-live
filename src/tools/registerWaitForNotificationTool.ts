import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { waitForNotification } from "../db/notifications.js";
import { createErrorToolResponse, createSuccessToolResponse } from "./response.js";

export function registerWaitForNotificationTool(server: McpServer) {
  server.registerTool(
    "wait_for_notification",
    {
      title: "Wait For Notification",
      description:
        "Listen for the next PostgreSQL notification on a channel, then return it or time out.",
      inputSchema: z.object({
        channel: z.string().min(1).default("pg_mcp_live_events"),
        timeoutMs: z.number().int().positive().max(30_000).optional(),
      }),
    },
    async ({ channel, timeoutMs }) => {
      try {
        const result = await waitForNotification(channel, timeoutMs);
        return createSuccessToolResponse(
          result.timedOut
            ? `Timed out waiting for notifications on "${result.channel}".`
            : `Received a notification on "${result.channel}".`,
          result,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return createErrorToolResponse("Failed to wait for notification.", message);
      }
    },
  );
}
