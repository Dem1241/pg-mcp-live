import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  PG_MCP_MAX_ROWS: z.coerce.number().int().positive().max(10_000).default(100),

  PG_MCP_STATEMENT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .max(60_000)
    .default(5_000),

  PG_MCP_ALLOWED_SCHEMAS: z
    .string()
    .default("public")
    .transform((value) =>
      value
        .split(",")
        .map((schema) => schema.trim())
        .filter(Boolean),
    ),
});

const parsedEnv = EnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const env = parsedEnv.data;
