import { assertSafeIdentifier, quoteIdentifier } from "../security/identifiers.js";
import { pool } from "./pool.js";

export type PostgresNotification = {
  channel: string;
  payload: string | null;
  parsedPayload: unknown | null;
  processId: number;
  receivedAt: string;
};

export type WaitForNotificationResult = {
  channel: string;
  timeoutMs: number;
  timedOut: boolean;
  notification: PostgresNotification | null;
};

type PgNotificationMessage = {
  channel: string;
  payload?: string;
  processId: number;
};

function normalizeTimeoutMs(timeoutMs: number | undefined) {
  if (timeoutMs === undefined) {
    return 10_000;
  }

  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("timeoutMs must be a positive integer.");
  }

  return Math.min(timeoutMs, 30_000);
}

function parsePayload(payload: string | undefined): unknown | null {
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export async function waitForNotification(
  channel: string,
  timeoutMs?: number,
): Promise<WaitForNotificationResult> {
  assertSafeIdentifier(channel, "notification channel");

  const safeTimeoutMs = normalizeTimeoutMs(timeoutMs);
  const quotedChannel = quoteIdentifier(channel);
  const client = await pool.connect();

  let timeout: NodeJS.Timeout | undefined;
  let handler: ((message: PgNotificationMessage) => void) | undefined;

  try {
    await client.query(`LISTEN ${quotedChannel}`);

    const notification = await new Promise<PostgresNotification | null>((resolve) => {
      let settled = false;

      const settle = (value: PostgresNotification | null) => {
        if (settled) {
          return;
        }

        settled = true;

        if (timeout) {
          clearTimeout(timeout);
        }

        if (handler) {
          client.off("notification", handler);
        }

        resolve(value);
      };

      handler = (message: PgNotificationMessage) => {
        if (message.channel !== channel) {
          return;
        }

        settle({
          channel: message.channel,
          payload: message.payload ?? null,
          parsedPayload: parsePayload(message.payload),
          processId: message.processId,
          receivedAt: new Date().toISOString(),
        });
      };

      client.on("notification", handler);

      timeout = setTimeout(() => {
        settle(null);
      }, safeTimeoutMs);
    });

    return {
      channel,
      timeoutMs: safeTimeoutMs,
      timedOut: notification === null,
      notification,
    };
  } finally {
    if (handler) {
      client.off("notification", handler);
    }

    if (timeout) {
      clearTimeout(timeout);
    }

    await client.query(`UNLISTEN ${quotedChannel}`).catch(() => undefined);
    client.release();
  }
}
