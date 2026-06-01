import { env } from "../config/env.js";

export function ensureSchemaIsAllowed(schemaName: string) {
  if (!env.PG_MCP_ALLOWED_SCHEMAS.includes(schemaName)) {
    throw new Error(
      `Schema "${schemaName}" is not allowed. Allowed schemas: ${env.PG_MCP_ALLOWED_SCHEMAS.join(", ")}`,
    );
  }
}

export function getAllowedSchemas(schemaName?: string) {
  if (schemaName) {
    ensureSchemaIsAllowed(schemaName);
    return [schemaName];
  }

  return env.PG_MCP_ALLOWED_SCHEMAS;
}

export function normalizeLimit(
  limit: number | undefined,
  defaultLimit: number,
  maxLimit = env.PG_MCP_MAX_ROWS,
) {
  if (limit === undefined) {
    return Math.min(defaultLimit, maxLimit);
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("Limit must be a positive integer.");
  }

  return Math.min(limit, maxLimit);
}
