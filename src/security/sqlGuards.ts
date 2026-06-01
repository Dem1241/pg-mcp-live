const FORBIDDEN_SQL_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "TRUNCATE",
  "CREATE",
  "GRANT",
  "REVOKE",
  "COPY",
  "EXECUTE",
  "CALL",
  "MERGE",
  "VACUUM",
  "REINDEX",
  "REFRESH",
  "LOCK",
  "ANALYZE",
  "INTO",
];

export type ValidatedSelectQuery = {
  sql: string;
};

function normalizeAllowedSchemas(allowedSchemas: string[]) {
  return new Set(allowedSchemas.map((schemaName) => schemaName.toLowerCase()));
}

function stripTrailingSemicolon(sql: string) {
  return sql.trim().replace(/;+$/, "").trim();
}

function sanitizeSqlForKeywordScanning(sql: string) {
  let output = "";
  let index = 0;

  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];

    if (char === "'" ) {
      output += " ";
      index++;

      while (index < sql.length) {
        if (sql[index] === "'" && sql[index + 1] === "'") {
          index += 2;
          continue;
        }

        if (sql[index] === "'") {
          index++;
          break;
        }

        index++;
      }

      continue;
    }

    if (char === '"') {
      output += " ";
      index++;

      while (index < sql.length) {
        if (sql[index] === '"' && sql[index + 1] === '"') {
          index += 2;
          continue;
        }

        if (sql[index] === '"') {
          index++;
          break;
        }

        index++;
      }

      continue;
    }

    if (char === "-" && next === "-") {
      output += " ";
      index += 2;

      while (index < sql.length && sql[index] !== "\n") {
        index++;
      }

      continue;
    }

    if (char === "/" && next === "*") {
      output += " ";
      index += 2;

      while (index < sql.length) {
        if (sql[index] === "*" && sql[index + 1] === "/") {
          index += 2;
          break;
        }

        index++;
      }

      continue;
    }

    if (char === "$") {
      const match = sql.slice(index).match(/^\$[a-zA-Z_][a-zA-Z0-9_]*\$|^\$\$/);

      if (match) {
        const tag = match[0];
        output += " ";
        index += tag.length;

        const closingIndex = sql.indexOf(tag, index);

        if (closingIndex === -1) {
          throw new Error("Unterminated dollar-quoted string.");
        }

        index = closingIndex + tag.length;
        continue;
      }
    }

    output += char;
    index++;
  }

  return output;
}

function ensureNoMultipleStatements(sql: string) {
  const sanitized = sanitizeSqlForKeywordScanning(sql);
  const firstSemicolonIndex = sanitized.indexOf(";");

  if (firstSemicolonIndex === -1) {
    return;
  }

  const remaining = sanitized.slice(firstSemicolonIndex + 1).trim();

  if (remaining.length > 0) {
    throw new Error("Multiple SQL statements are not allowed.");
  }
}

function getLeadingKeyword(sql: string) {
  const sanitized = sanitizeSqlForKeywordScanning(sql).trim();
  const match = sanitized.match(/^([a-zA-Z]+)/);

  return match?.[1]?.toUpperCase() ?? null;
}

function ensureAllowedLeadingKeyword(sql: string) {
  const keyword = getLeadingKeyword(sql);

  if (keyword !== "SELECT" && keyword !== "WITH") {
    throw new Error("Only SELECT queries and read-only WITH queries are allowed.");
  }
}

function ensureNoForbiddenKeywords(sql: string) {
  const sanitized = sanitizeSqlForKeywordScanning(sql).toUpperCase();

  if (/\bFOR\s+(UPDATE|NO\s+KEY\s+UPDATE|SHARE|KEY\s+SHARE)\b/i.test(sanitized)) {
    throw new Error("Row-locking clauses are not allowed.");
  }

  for (const keyword of FORBIDDEN_SQL_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`, "i");

    if (pattern.test(sanitized)) {
      throw new Error(`Forbidden SQL keyword detected: ${keyword}`);
    }
  }

  if (/\$\d+\b/.test(sanitized)) {
    throw new Error("SQL parameter placeholders are not supported in user queries.");
  }
}

function ensureOnlyAllowedSchemas(sql: string, allowedSchemas: string[]) {
  const sanitized = sanitizeSqlForKeywordScanning(sql);
  const normalizedAllowedSchemas = normalizeAllowedSchemas(allowedSchemas);
  const schemaReferencePattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*[a-zA-Z_][a-zA-Z0-9_]*\b/g;

  for (const match of sanitized.matchAll(schemaReferencePattern)) {
    const schemaName = match[1]?.toLowerCase();

    if (!schemaName) {
      continue;
    }

    if (!normalizedAllowedSchemas.has(schemaName)) {
      throw new Error(
        `Schema-qualified references are limited to allowed schemas. Found "${match[1]}".`,
      );
    }
  }
}

export function validateReadOnlySelectQuery(
  sql: string,
  allowedSchemas: string[] = ["public"],
): ValidatedSelectQuery {
  const trimmed = sql.trim();

  if (!trimmed) {
    throw new Error("SQL query cannot be empty.");
  }

  if (trimmed.length > 20_000) {
    throw new Error("SQL query is too long.");
  }

  ensureNoMultipleStatements(trimmed);
  ensureAllowedLeadingKeyword(trimmed);
  ensureNoForbiddenKeywords(trimmed);
  ensureOnlyAllowedSchemas(trimmed, allowedSchemas);

  return {
    // This validator is a pragmatic guardrail, not a substitute for a least-privileged DB role.
    sql: stripTrailingSemicolon(trimmed),
  };
}
