import { pool } from "./pool.js";

export type DatabaseHealth = {
  ok: true;
  databaseTime: string;
  currentDatabase: string;
  currentUser: string;
  postgresVersion: string;
};

type DatabaseHealthRow = {
  database_time: Date;
  current_database: string;
  current_user: string;
  postgres_version: string;
};

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const result = await pool.query<DatabaseHealthRow>(`
    SELECT
      NOW() AS database_time,
      current_database() AS current_database,
      current_user AS current_user,
      version() AS postgres_version;
  `);

  const row = result.rows[0];

  return {
    ok: true,
    databaseTime: row.database_time.toISOString(),
    currentDatabase: row.current_database,
    currentUser: row.current_user,
    postgresVersion: row.postgres_version,
  };
}
