import {
  ResourceTemplate,
  type McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";

import { describeTable, listSchemas, listTables } from "../db/introspection.js";

function getTemplateValue(
  variables: Record<string, string | string[]>,
  key: string,
): string {
  const value = variables[key];

  if (Array.isArray(value)) {
    throw new Error(`Expected single value for "${key}", but received multiple values.`);
  }

  if (!value) {
    throw new Error(`Missing required resource parameter: ${key}`);
  }

  return value;
}

export function registerPostgresResources(server: McpServer) {
  server.registerResource(
    "postgres-schemas",
    "postgres://schemas",
    {
      title: "PostgreSQL Schemas",
      description: "List of PostgreSQL schemas exposed by pg-mcp-live.",
      mimeType: "application/json",
    },
    async (uri) => {
      const schemas = await listSchemas();

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                kind: "schemas",
                schemas,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerResource(
    "postgres-schema",
    new ResourceTemplate("postgres://schema/{schemaName}", {
      list: async () => {
        const schemas = await listSchemas();

        return {
          resources: schemas.map((schema) => ({
            uri: `postgres://schema/${schema.schemaName}`,
            name: `Schema: ${schema.schemaName}`,
            title: `Schema: ${schema.schemaName}`,
            description: `Tables exposed from the "${schema.schemaName}" PostgreSQL schema.`,
            mimeType: "application/json",
          })),
        };
      },
    }),
    {
      title: "PostgreSQL Schema",
      description: "Tables inside a PostgreSQL schema exposed by pg-mcp-live.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const schemaName = getTemplateValue(variables, "schemaName");
      const tables = await listTables(schemaName);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                kind: "schema",
                schemaName,
                tables,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerResource(
    "postgres-table",
    new ResourceTemplate("postgres://table/{schemaName}/{tableName}", {
      list: async () => {
        const tables = await listTables();

        return {
          resources: tables.map((table) => ({
            uri: `postgres://table/${table.tableSchema}/${table.tableName}`,
            name: `Table: ${table.tableSchema}.${table.tableName}`,
            title: `Table: ${table.tableSchema}.${table.tableName}`,
            description: `Column, primary key, and foreign key metadata for "${table.tableSchema}.${table.tableName}".`,
            mimeType: "application/json",
          })),
        };
      },
    }),
    {
      title: "PostgreSQL Table",
      description:
        "Column, primary key, and foreign key metadata for a PostgreSQL table exposed by pg-mcp-live.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const schemaName = getTemplateValue(variables, "schemaName");
      const tableName = getTemplateValue(variables, "tableName");

      const tableDescription = await describeTable(schemaName, tableName);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                kind: "table",
                ...tableDescription,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
