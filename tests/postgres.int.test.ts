import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { explainSafeSelectQuery } from "../src/db/explainQuery.js";
import { checkDatabaseHealth } from "../src/db/health.js";
import { describeTable, listSchemas, listTables } from "../src/db/introspection.js";
import { closePool } from "../src/db/pool.js";
import { getTableSample } from "../src/db/sampleRows.js";
import { runSafeSelectQuery } from "../src/db/safeQuery.js";

describe("PostgreSQL integration", () => {
  beforeAll(async () => {
    await checkDatabaseHealth();
  }, 10_000);

  afterAll(async () => {
    await closePool();
  });

  it("connects to the demo database", async () => {
    const health = await checkDatabaseHealth();

    expect(health.ok).toBe(true);
    expect(health.currentDatabase).toBe("pg_mcp_live_demo");
    expect(health.currentUser).toBe("pgmcp");
    expect(health.postgresVersion).toContain("PostgreSQL");
  });

  it("lists allowed schemas", async () => {
    const schemas = await listSchemas();

    expect(schemas).toEqual([{ schemaName: "public" }]);
  });

  it("lists demo tables", async () => {
    const tables = await listTables("public");
    const tableNames = tables.map((table) => table.tableName);

    expect(tableNames).toEqual(
      expect.arrayContaining([
        "customers",
        "products",
        "inventory",
        "orders",
        "order_items",
      ]),
    );
  });

  it("describes table columns, primary keys, and foreign keys", async () => {
    const table = await describeTable("public", "order_items");

    expect(table.schemaName).toBe("public");
    expect(table.tableName).toBe("order_items");
    expect(table.primaryKeyColumns).toEqual(["id"]);

    expect(table.columns.map((column) => column.columnName)).toEqual(
      expect.arrayContaining(["id", "order_id", "product_id", "quantity", "unit_price_cents"]),
    );

    expect(table.foreignKeys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          columnName: "order_id",
          foreignTableName: "orders",
          foreignColumnName: "id",
        }),
        expect.objectContaining({
          columnName: "product_id",
          foreignTableName: "products",
          foreignColumnName: "id",
        }),
      ]),
    );
  });

  it("returns a safe table sample", async () => {
    const sample = await getTableSample("public", "products", 3);

    expect(sample.schemaName).toBe("public");
    expect(sample.tableName).toBe("products");
    expect(sample.limit).toBe(3);
    expect(sample.rowCount).toBeLessThanOrEqual(3);
    expect(sample.rows.length).toBeGreaterThan(0);
    expect(sample.rows[0]).toHaveProperty("sku");
    expect(sample.rows[0]).toHaveProperty("name");
  });

  it("rejects unsafe table names in sample requests", async () => {
    await expect(
      getTableSample("public", "products; DROP TABLE customers;", 3),
    ).rejects.toThrow("Invalid table name");
  });

  it("runs a guarded SELECT query", async () => {
    const result = await runSafeSelectQuery(
      "SELECT id, sku, name, price_cents FROM products ORDER BY id",
      2,
    );

    expect(result.limit).toBe(2);
    expect(result.rowCount).toBeLessThanOrEqual(2);
    expect(result.columns).toEqual(expect.arrayContaining(["id", "sku", "name", "price_cents"]));
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it("rejects unsafe SQL in guarded query execution", async () => {
    await expect(runSafeSelectQuery("DROP TABLE products")).rejects.toThrow(
      "Only SELECT queries and read-only WITH queries are allowed.",
    );

    await expect(runSafeSelectQuery("SELECT * FROM products FOR UPDATE")).rejects.toThrow(
      "Row-locking clauses are not allowed.",
    );
  });

  it("returns a safe EXPLAIN plan", async () => {
    const result = await explainSafeSelectQuery(
      "SELECT id, sku, name FROM products ORDER BY id",
      5,
    );

    expect(result.sql).toBe("SELECT id, sku, name FROM products ORDER BY id");
    expect(result.limit).toBe(5);
    expect(result.plan).toBeTruthy();
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });
});
