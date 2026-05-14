import { env } from "../config/env.js";
import { pool } from "./pool.js";

export type DatabaseSchema = {
  schemaName: string;
};

export type DatabaseTable = {
  tableSchema: string;
  tableName: string;
  tableType: string;
};

export type TableColumn = {
  columnName: string;
  ordinalPosition: number;
  dataType: string;
  udtName: string;
  isNullable: boolean;
  columnDefault: string | null;
  characterMaximumLength: number | null;
  numericPrecision: number | null;
  numericScale: number | null;
};

export type ForeignKey = {
  constraintName: string;
  columnName: string;
  foreignTableSchema: string;
  foreignTableName: string;
  foreignColumnName: string;
};

export type TableDescription = {
  schemaName: string;
  tableName: string;
  columns: TableColumn[];
  primaryKeyColumns: string[];
  foreignKeys: ForeignKey[];
};

type SchemaRow = {
  schema_name: string;
};

type TableRow = {
  table_schema: string;
  table_name: string;
  table_type: string;
};

type ColumnRow = {
  column_name: string;
  ordinal_position: number;
  data_type: string;
  udt_name: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
};

type PrimaryKeyRow = {
  column_name: string;
};

type ForeignKeyRow = {
  constraint_name: string;
  column_name: string;
  foreign_table_schema: string;
  foreign_table_name: string;
  foreign_column_name: string;
};

function ensureSchemaIsAllowed(schemaName: string) {
  if (!env.PG_MCP_ALLOWED_SCHEMAS.includes(schemaName)) {
    throw new Error(
      `Schema "${schemaName}" is not allowed. Allowed schemas: ${env.PG_MCP_ALLOWED_SCHEMAS.join(", ")}`,
    );
  }
}

export async function listSchemas(): Promise<DatabaseSchema[]> {
  const result = await pool.query<SchemaRow>(
    `
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = ANY($1::text[])
      ORDER BY schema_name;
    `,
    [env.PG_MCP_ALLOWED_SCHEMAS],
  );

  return result.rows.map((row) => ({
    schemaName: row.schema_name,
  }));
}

export async function listTables(schemaName?: string): Promise<DatabaseTable[]> {
  if (schemaName) {
    ensureSchemaIsAllowed(schemaName);
  }

  const result = await pool.query<TableRow>(
    `
      SELECT
        table_schema,
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema = ANY($1::text[])
        AND ($2::text IS NULL OR table_schema = $2)
      ORDER BY table_schema, table_name;
    `,
    [env.PG_MCP_ALLOWED_SCHEMAS, schemaName ?? null],
  );

  return result.rows.map((row) => ({
    tableSchema: row.table_schema,
    tableName: row.table_name,
    tableType: row.table_type,
  }));
}

async function assertTableExists(schemaName: string, tableName: string) {
  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_name = $2
          AND table_type = 'BASE TABLE'
      ) AS exists;
    `,
    [schemaName, tableName],
  );

  if (!result.rows[0]?.exists) {
    throw new Error(`Table "${schemaName}.${tableName}" does not exist or is not a base table.`);
  }
}

export async function describeTable(
  schemaName: string,
  tableName: string,
): Promise<TableDescription> {
  ensureSchemaIsAllowed(schemaName);
  await assertTableExists(schemaName, tableName);

  const columnsResult = await pool.query<ColumnRow>(
    `
      SELECT
        column_name,
        ordinal_position,
        data_type,
        udt_name,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
      ORDER BY ordinal_position;
    `,
    [schemaName, tableName],
  );

  const primaryKeyResult = await pool.query<PrimaryKeyRow>(
    `
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
        AND tc.table_name = kcu.table_name
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
      ORDER BY kcu.ordinal_position;
    `,
    [schemaName, tableName],
  );

  const foreignKeysResult = await pool.query<ForeignKeyRow>(
    `
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
        AND tc.table_name = kcu.table_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.constraint_schema = tc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
      ORDER BY tc.constraint_name, kcu.ordinal_position;
    `,
    [schemaName, tableName],
  );

  return {
    schemaName,
    tableName,
    columns: columnsResult.rows.map((row) => ({
      columnName: row.column_name,
      ordinalPosition: row.ordinal_position,
      dataType: row.data_type,
      udtName: row.udt_name,
      isNullable: row.is_nullable === "YES",
      columnDefault: row.column_default,
      characterMaximumLength: row.character_maximum_length,
      numericPrecision: row.numeric_precision,
      numericScale: row.numeric_scale,
    })),
    primaryKeyColumns: primaryKeyResult.rows.map((row) => row.column_name),
    foreignKeys: foreignKeysResult.rows.map((row) => ({
      constraintName: row.constraint_name,
      columnName: row.column_name,
      foreignTableSchema: row.foreign_table_schema,
      foreignTableName: row.foreign_table_name,
      foreignColumnName: row.foreign_column_name,
    })),
  };
}
