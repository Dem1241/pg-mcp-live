import { beforeAll, describe, expect, it } from "vitest";

import { checkDatabaseHealth } from "../src/db/health.js";
import { describeTable, listSchemas, listTables } from "../src/db/introspection.js";
import { summarizeRelationships } from "../src/db/relationships.js";
import { ensureDemoDatabaseReady } from "./helpers/demoDatabase.js";

describe("PostgreSQL introspection integration", () => {
  beforeAll(async () => {
    await ensureDemoDatabaseReady();
  }, 10_000);
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

  it("lists only base tables", async () => {
    const { pool } = await import("../src/db/pool.js");

    await pool.query(`
      CREATE OR REPLACE VIEW public.pgmcp_test_products_view AS
      SELECT id, sku
      FROM products;
    `);

    try {
      const tables = await listTables("public");
      const tableNames = tables.map((table) => table.tableName);

      expect(tableNames).not.toContain("pgmcp_test_products_view");
    } finally {
      await pool.query("DROP VIEW IF EXISTS public.pgmcp_test_products_view");
    }
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

  it("describes indexes for a table", async () => {
    const table = await describeTable("public", "order_items");

    expect(table.indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexName: "order_items_pkey",
          isPrimary: true,
          isUnique: true,
          columnNames: ["id"],
        }),
        expect.objectContaining({
          indexName: "idx_order_items_order_id",
          isPrimary: false,
          columnNames: ["order_id"],
        }),
        expect.objectContaining({
          indexName: "idx_order_items_product_id",
          isPrimary: false,
          columnNames: ["product_id"],
        }),
      ]),
    );
  });

  it("describes unique constraints", async () => {
    const table = await describeTable("public", "products");

    expect(table.uniqueConstraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          columnNames: ["sku"],
        }),
      ]),
    );
  });

  it("describes check constraints", async () => {
    const products = await describeTable("public", "products");
    const orderItems = await describeTable("public", "order_items");

    expect(products.checkConstraints.length).toBeGreaterThan(0);
    expect(orderItems.checkConstraints.length).toBeGreaterThan(0);

    expect(products.checkConstraints.map((constraint) => constraint.definition).join("\n")).toContain(
      "price_cents",
    );
    expect(orderItems.checkConstraints.map((constraint) => constraint.definition).join("\n")).toContain(
      "quantity",
    );
  });

  it("returns table stats", async () => {
    const table = await describeTable("public", "products");

    expect(table.stats).not.toBeNull();
    expect(table.stats?.estimatedRowCount).toBeGreaterThanOrEqual(0);
    expect(table.stats?.tableSizeBytes).toBeGreaterThanOrEqual(0);
    expect(table.stats?.indexSizeBytes).toBeGreaterThanOrEqual(0);
    expect(table.stats?.totalSizeBytes).toBeGreaterThanOrEqual(0);
    expect(table.stats?.totalSize).toEqual(expect.any(String));
  });

  it("summarizes database relationships", async () => {
    const summary = await summarizeRelationships("public");

    expect(summary.schemas).toEqual(["public"]);
    expect(summary.relationshipCount).toBeGreaterThanOrEqual(4);
    expect(summary.graphLines).toEqual(
      expect.arrayContaining([
        "public.customers.id -> public.orders.customer_id",
        "public.orders.id -> public.order_items.order_id",
        "public.products.id -> public.inventory.product_id",
        "public.products.id -> public.order_items.product_id",
      ]),
    );
    expect(summary.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceTableName: "orders",
          sourceColumnName: "customer_id",
          targetTableName: "customers",
          targetColumnName: "id",
        }),
      ]),
    );
  });
});
