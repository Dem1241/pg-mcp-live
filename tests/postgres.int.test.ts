import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { explainSafeSelectQuery } from "../src/db/explainQuery.js";
import { checkDatabaseHealth } from "../src/db/health.js";
import { describeTable, listSchemas, listTables } from "../src/db/introspection.js";
import { summarizeRelationships } from "../src/db/relationships.js";
import { waitForNotification } from "../src/db/notifications.js";
import { closePool, pool } from "../src/db/pool.js";
import { getTableSample } from "../src/db/sampleRows.js";
import { getRecentEvents } from "../src/db/recentEvents.js";
import { summarizeRecentActivity } from "../src/db/eventActivity.js";
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

  it("lists only base tables", async () => {
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

  it("summarizes recent table-change activity", async () => {
    const eventLogSql = await readFile(
      new URL("../examples/event-log.sql", import.meta.url),
      "utf8",
    );

    await pool.query(eventLogSql);
    await pool.query("TRUNCATE TABLE pg_mcp_live_event_log RESTART IDENTITY");

    await pool.query(
      `
        UPDATE inventory
        SET quantity = quantity - 1,
            updated_at = NOW()
        WHERE product_id = 1;
      `,
    );

    await pool.query(
      `
        UPDATE inventory
        SET quantity = quantity - 1,
            updated_at = NOW()
        WHERE product_id = 1;
      `,
    );

    const summary = await summarizeRecentActivity({
      schemaName: "public",
      tableName: "inventory",
      operation: "UPDATE",
      sinceMinutes: 60,
      limit: 5,
    });

    expect(summary.totalEvents).toBeGreaterThanOrEqual(2);
    expect(summary.byTable).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schemaName: "public",
          tableName: "inventory",
          updateCount: expect.any(Number),
        }),
      ]),
    );
    expect(summary.byOperation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: "UPDATE",
        }),
      ]),
    );
    expect(summary.latestEvents.length).toBeGreaterThan(0);
    expect(summary.latestEvents[0]).toEqual(
      expect.objectContaining({
        operation: "UPDATE",
        schemaName: "public",
        tableName: "inventory",
      }),
    );
  });

  it("stores and returns recent table-change events", async () => {
    const eventLogSql = await readFile(
      new URL("../examples/event-log.sql", import.meta.url),
      "utf8",
    );

    await pool.query(eventLogSql);
    await pool.query("TRUNCATE TABLE pg_mcp_live_event_log RESTART IDENTITY");

    await pool.query(
      `
        UPDATE inventory
        SET quantity = quantity - 1,
            updated_at = NOW()
        WHERE product_id = 1;
      `,
    );

    const result = await getRecentEvents({
      schemaName: "public",
      tableName: "inventory",
      operation: "UPDATE",
      limit: 5,
    });

    expect(result.eventCount).toBeGreaterThanOrEqual(1);
    expect(result.events[0]).toEqual(
      expect.objectContaining({
        operation: "UPDATE",
        schemaName: "public",
        tableName: "inventory",
      }),
    );
    expect(result.events[0]?.oldRow).toHaveProperty("quantity");
    expect(result.events[0]?.newRow).toHaveProperty("quantity");
  });

  it("waits for a PostgreSQL notification", async () => {
    const channel = "pg_mcp_live_events";
    const payload = {
      event: "inventory_changed",
      productId: 1,
    };

    const waitPromise = waitForNotification(channel, 5_000);

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });

    await pool.query("SELECT pg_notify($1, $2)", [channel, JSON.stringify(payload)]);

    const result = await waitPromise;

    expect(result.channel).toBe(channel);
    expect(result.timedOut).toBe(false);
    expect(result.notification?.channel).toBe(channel);
    expect(result.notification?.payload).toBe(JSON.stringify(payload));
    expect(result.notification?.parsedPayload).toEqual(payload);
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
