const POSTGRES_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function assertSafeIdentifier(identifier: string, label: string) {
  if (!POSTGRES_IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(
      `Invalid ${label} "${identifier}". Only letters, numbers, and underscores are allowed, and it cannot start with a number.`,
    );
  }
}

export function quoteIdentifier(identifier: string) {
  assertSafeIdentifier(identifier, "identifier");

  return `"${identifier.replaceAll('"', '""')}"`;
}

export function quoteQualifiedTableName(schemaName: string, tableName: string) {
  assertSafeIdentifier(schemaName, "schema name");
  assertSafeIdentifier(tableName, "table name");

  return `${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`;
}
