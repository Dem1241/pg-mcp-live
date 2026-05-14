import { Pool } from "pg";

import { env } from "../config/env.js";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export async function closePool() {
  await pool.end();
}
