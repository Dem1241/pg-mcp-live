import { getAllowedSchemas } from "./guards.js";
import { pool } from "./pool.js";

export type DatabaseRelationship = {
  constraintName: string;
  sourceTableSchema: string;
  sourceTableName: string;
  sourceColumnName: string;
  targetTableSchema: string;
  targetTableName: string;
  targetColumnName: string;
};

export type RelationshipSummary = {
  schemas: string[];
  relationshipCount: number;
  relationships: DatabaseRelationship[];
  graphLines: string[];
};

type RelationshipRow = {
  constraint_name: string;
  source_table_schema: string;
  source_table_name: string;
  source_column_name: string;
  target_table_schema: string;
  target_table_name: string;
  target_column_name: string;
};

export async function summarizeRelationships(
  schemaName?: string,
): Promise<RelationshipSummary> {
  const schemas = getAllowedSchemas(schemaName);

  const result = await pool.query<RelationshipRow>(
    `
      SELECT
        constraint_info.conname AS constraint_name,
        source_namespace.nspname AS source_table_schema,
        source_table.relname AS source_table_name,
        source_attribute.attname AS source_column_name,
        target_namespace.nspname AS target_table_schema,
        target_table.relname AS target_table_name,
        target_attribute.attname AS target_column_name
      FROM pg_constraint constraint_info
      JOIN pg_class source_table
        ON source_table.oid = constraint_info.conrelid
      JOIN pg_namespace source_namespace
        ON source_namespace.oid = source_table.relnamespace
      JOIN pg_class target_table
        ON target_table.oid = constraint_info.confrelid
      JOIN pg_namespace target_namespace
        ON target_namespace.oid = target_table.relnamespace
      JOIN LATERAL unnest(constraint_info.conkey) WITH ORDINALITY AS source_columns(attnum, ordinality)
        ON true
      JOIN LATERAL unnest(constraint_info.confkey) WITH ORDINALITY AS target_columns(attnum, ordinality)
        ON target_columns.ordinality = source_columns.ordinality
      JOIN pg_attribute source_attribute
        ON source_attribute.attrelid = source_table.oid
        AND source_attribute.attnum = source_columns.attnum
      JOIN pg_attribute target_attribute
        ON target_attribute.attrelid = target_table.oid
        AND target_attribute.attnum = target_columns.attnum
      WHERE constraint_info.contype = 'f'
        AND source_namespace.nspname = ANY($1::text[])
        AND target_namespace.nspname = ANY($1::text[])
      ORDER BY
        target_namespace.nspname,
        target_table.relname,
        target_attribute.attname,
        source_namespace.nspname,
        source_table.relname,
        source_attribute.attname;
    `,
    [schemas],
  );

  const relationships = result.rows.map((row) => ({
    constraintName: row.constraint_name,
    sourceTableSchema: row.source_table_schema,
    sourceTableName: row.source_table_name,
    sourceColumnName: row.source_column_name,
    targetTableSchema: row.target_table_schema,
    targetTableName: row.target_table_name,
    targetColumnName: row.target_column_name,
  }));

  const graphLines = relationships.map(
    (relationship) =>
      `${relationship.targetTableSchema}.${relationship.targetTableName}.${relationship.targetColumnName} -> ${relationship.sourceTableSchema}.${relationship.sourceTableName}.${relationship.sourceColumnName}`,
  );

  return {
    schemas,
    relationshipCount: relationships.length,
    relationships,
    graphLines,
  };
}
