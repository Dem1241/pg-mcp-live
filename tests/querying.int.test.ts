import { beforeAll, describe, expect, it } from "vitest";

import { explainSafeSelectQuery } from "../src/db/explainQuery.js";
import { getTableSample } from "../src/db/sampleRows.js";
import { runSafeSelectQuery } from "../src/db/safeQuery.js";
import { ensureDemoDatabaseReady } from "./helpers/demoDatabase.js";

describe("PostgreSQL querying integration", () => {
  beforeAll(async () => {
    await ensureDemoDatabaseReady();
  }, 10_000);
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
    await expect(runSafeSelectQuery("SELECT * FROM information_schema.tables")).rejects.toThrow(
      'Schema-qualified references are limited to allowed schemas. Found "information_schema".',
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

  it("rejects EXPLAIN requests outside allowed schemas", async () => {
    await expect(explainSafeSelectQuery("SELECT * FROM pg_catalog.pg_class")).rejects.toThrow(
      'Schema-qualified references are limited to allowed schemas. Found "pg_catalog".',
    );
  });
});
