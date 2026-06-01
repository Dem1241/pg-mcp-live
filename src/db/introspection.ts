import { getAllowedSchemas } from "./guards.js";
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

export type TableIndex = {
  indexName: string;
  columnNames: string[];
  isUnique: boolean;
  isPrimary: boolean;
  definition: string;
};

export type UniqueConstraint = {
  constraintName: string;
  columnNames: string[];
};

export type CheckConstraint = {
  constraintName: string;
  definition: string;
};

export type TableStats = {
  estimatedRowCount: number;
  tableSizeBytes: number;
  indexSizeBytes: number;
  totalSizeBytes: number;
  totalSize: string;
};

export type TableDescription = {
  schemaName: string;
  tableName: string;
  columns: TableColumn[];
  primaryKeyColumns: string[];
  foreignKeys: ForeignKey[];
  indexes: TableIndex[];
  uniqueConstraints: UniqueConstraint[];
  checkConstraints: CheckConstraint[];
  stats: TableStats | null;
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

type IndexRow = {
  index_name: string;
  column_names: string[] | string | null;
  is_unique: boolean;
  is_primary: boolean;
  index_definition: string;
};

type UniqueConstraintRow = {
  constraint_name: string;
  column_names: string[] | string | null;
};

type CheckConstraintRow = {
  constraint_name: string;
  definition: string;
};

type TableStatsRow = {
  estimated_row_count: string | number;
  table_size_bytes: string | number;
  index_size_bytes: string | number;
  total_size_bytes: string | number;
  total_size: string;
};

function normalizeColumnNames(columnNames: string[] | string | null): string[] {
  if (!columnNames) {
    return [];
  }

  if (Array.isArray(columnNames)) {
    return columnNames;
  }

  return columnNames
    .replace(/^\{/, "")
    .replace(/\}$/, "")
    .split(",")
    .map((columnName) => columnName.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

export async function listSchemas(): Promise<DatabaseSchema[]> {
  const result = await pool.query<SchemaRow>(
    `
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = ANY($1::text[])
      ORDER BY schema_name;
    `,
    [getAllowedSchemas()],
  );

  return result.rows.map((row) => ({
    schemaName: row.schema_name,
  }));
}

export async function listTables(schemaName?: string): Promise<DatabaseTable[]> {
  const schemas = getAllowedSchemas(schemaName);

  const result = await pool.query<TableRow>(
    `
      SELECT
        table_schema,
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema = ANY($1::text[])
        AND table_type = 'BASE TABLE'
        AND ($2::text IS NULL OR table_schema = $2)
      ORDER BY table_schema, table_name;
    `,
    [schemas, schemaName ?? null],
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

async function getColumns(schemaName: string, tableName: string): Promise<TableColumn[]> {
  const result = await pool.query<ColumnRow>(
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

  return result.rows.map((row) => ({
    columnName: row.column_name,
    ordinalPosition: row.ordinal_position,
    dataType: row.data_type,
    udtName: row.udt_name,
    isNullable: row.is_nullable === "YES",
    columnDefault: row.column_default,
    characterMaximumLength: row.character_maximum_length,
    numericPrecision: row.numeric_precision,
    numericScale: row.numeric_scale,
  }));
}

async function getPrimaryKeyColumns(schemaName: string, tableName: string): Promise<string[]> {
  const result = await pool.query<PrimaryKeyRow>(
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

  return result.rows.map((row) => row.column_name);
}

async function getForeignKeys(schemaName: string, tableName: string): Promise<ForeignKey[]> {
  const result = await pool.query<ForeignKeyRow>(
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

  return result.rows.map((row) => ({
    constraintName: row.constraint_name,
    columnName: row.column_name,
    foreignTableSchema: row.foreign_table_schema,
    foreignTableName: row.foreign_table_name,
    foreignColumnName: row.foreign_column_name,
  }));
}

async function getIndexes(schemaName: string, tableName: string): Promise<TableIndex[]> {
  const result = await pool.query<IndexRow>(
    `
      SELECT
        index_class.relname AS index_name,
        COALESCE(
          array_agg(attribute.attname ORDER BY index_keys.ordinality)
            FILTER (WHERE attribute.attname IS NOT NULL),
          '{}'
        ) AS column_names,
        pg_index.indisunique AS is_unique,
        pg_index.indisprimary AS is_primary,
        pg_get_indexdef(pg_index.indexrelid) AS index_definition
      FROM pg_index
      JOIN pg_class table_class
        ON table_class.oid = pg_index.indrelid
      JOIN pg_namespace table_namespace
        ON table_namespace.oid = table_class.relnamespace
      JOIN pg_class index_class
        ON index_class.oid = pg_index.indexrelid
      LEFT JOIN LATERAL unnest(pg_index.indkey) WITH ORDINALITY AS index_keys(attnum, ordinality)
        ON true
      LEFT JOIN pg_attribute attribute
        ON attribute.attrelid = table_class.oid
        AND attribute.attnum = index_keys.attnum
      WHERE table_namespace.nspname = $1
        AND table_class.relname = $2
      GROUP BY
        index_class.relname,
        pg_index.indisunique,
        pg_index.indisprimary,
        pg_index.indexrelid
      ORDER BY index_class.relname;
    `,
    [schemaName, tableName],
  );

  return result.rows.map((row) => ({
    indexName: row.index_name,
    columnNames: normalizeColumnNames(row.column_names),
    isUnique: row.is_unique,
    isPrimary: row.is_primary,
    definition: row.index_definition,
  }));
}

async function getUniqueConstraints(
  schemaName: string,
  tableName: string,
): Promise<UniqueConstraint[]> {
  const result = await pool.query<UniqueConstraintRow>(
    `
      SELECT
        pg_constraint.conname AS constraint_name,
        COALESCE(
          array_agg(attribute.attname ORDER BY constraint_keys.ordinality)
            FILTER (WHERE attribute.attname IS NOT NULL),
          '{}'
        ) AS column_names
      FROM pg_constraint
      JOIN pg_class table_class
        ON table_class.oid = pg_constraint.conrelid
      JOIN pg_namespace table_namespace
        ON table_namespace.oid = table_class.relnamespace
      LEFT JOIN LATERAL unnest(pg_constraint.conkey) WITH ORDINALITY AS constraint_keys(attnum, ordinality)
        ON true
      LEFT JOIN pg_attribute attribute
        ON attribute.attrelid = table_class.oid
        AND attribute.attnum = constraint_keys.attnum
      WHERE table_namespace.nspname = $1
        AND table_class.relname = $2
        AND pg_constraint.contype = 'u'
      GROUP BY pg_constraint.conname
      ORDER BY pg_constraint.conname;
    `,
    [schemaName, tableName],
  );

  return result.rows.map((row) => ({
    constraintName: row.constraint_name,
    columnNames: normalizeColumnNames(row.column_names),
  }));
}

async function getCheckConstraints(
  schemaName: string,
  tableName: string,
): Promise<CheckConstraint[]> {
  const result = await pool.query<CheckConstraintRow>(
    `
      SELECT
        pg_constraint.conname AS constraint_name,
        pg_get_constraintdef(pg_constraint.oid, true) AS definition
      FROM pg_constraint
      JOIN pg_class table_class
        ON table_class.oid = pg_constraint.conrelid
      JOIN pg_namespace table_namespace
        ON table_namespace.oid = table_class.relnamespace
      WHERE table_namespace.nspname = $1
        AND table_class.relname = $2
        AND pg_constraint.contype = 'c'
      ORDER BY pg_constraint.conname;
    `,
    [schemaName, tableName],
  );

  return result.rows.map((row) => ({
    constraintName: row.constraint_name,
    definition: row.definition,
  }));
}

async function getTableStats(schemaName: string, tableName: string): Promise<TableStats | null> {
  const result = await pool.query<TableStatsRow>(
    `
      SELECT
        GREATEST(table_class.reltuples::bigint, 0) AS estimated_row_count,
        pg_relation_size(table_class.oid) AS table_size_bytes,
        pg_indexes_size(table_class.oid) AS index_size_bytes,
        pg_total_relation_size(table_class.oid) AS total_size_bytes,
        pg_size_pretty(pg_total_relation_size(table_class.oid)) AS total_size
      FROM pg_class table_class
      JOIN pg_namespace table_namespace
        ON table_namespace.oid = table_class.relnamespace
      WHERE table_namespace.nspname = $1
        AND table_class.relname = $2
        AND table_class.relkind = 'r';
    `,
    [schemaName, tableName],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    estimatedRowCount: Number(row.estimated_row_count),
    tableSizeBytes: Number(row.table_size_bytes),
    indexSizeBytes: Number(row.index_size_bytes),
    totalSizeBytes: Number(row.total_size_bytes),
    totalSize: row.total_size,
  };
}

export async function describeTable(
  schemaName: string,
  tableName: string,
): Promise<TableDescription> {
  getAllowedSchemas(schemaName);
  await assertTableExists(schemaName, tableName);

  const [
    columns,
    primaryKeyColumns,
    foreignKeys,
    indexes,
    uniqueConstraints,
    checkConstraints,
    stats,
  ] = await Promise.all([
    getColumns(schemaName, tableName),
    getPrimaryKeyColumns(schemaName, tableName),
    getForeignKeys(schemaName, tableName),
    getIndexes(schemaName, tableName),
    getUniqueConstraints(schemaName, tableName),
    getCheckConstraints(schemaName, tableName),
    getTableStats(schemaName, tableName),
  ]);

  return {
    schemaName,
    tableName,
    columns,
    primaryKeyColumns,
    foreignKeys,
    indexes,
    uniqueConstraints,
    checkConstraints,
    stats,
  };
}
