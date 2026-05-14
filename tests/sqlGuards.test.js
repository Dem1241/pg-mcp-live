import { describe, expect, it } from "vitest";
import { validateReadOnlySelectQuery } from "../src/security/sqlGuards.js";
describe("validateReadOnlySelectQuery", () => {
    it("allows a simple SELECT query", () => {
        const result = validateReadOnlySelectQuery("SELECT * FROM products");
        expect(result.sql).toBe("SELECT * FROM products");
    });
    it("allows a SELECT query with a trailing semicolon", () => {
        const result = validateReadOnlySelectQuery("SELECT * FROM products;");
        expect(result.sql).toBe("SELECT * FROM products");
    });
    it("allows a read-only WITH query", () => {
        const result = validateReadOnlySelectQuery(`
      WITH recent_orders AS (
        SELECT * FROM orders
      )
      SELECT * FROM recent_orders
    `);
        expect(result.sql).toContain("WITH recent_orders");
    });
    it("rejects empty SQL", () => {
        expect(() => validateReadOnlySelectQuery("")).toThrow("SQL query cannot be empty.");
    });
    it("rejects DROP statements", () => {
        expect(() => validateReadOnlySelectQuery("DROP TABLE products")).toThrow("Only SELECT queries and read-only WITH queries are allowed.");
    });
    it("rejects DELETE statements", () => {
        expect(() => validateReadOnlySelectQuery("DELETE FROM products")).toThrow("Only SELECT queries and read-only WITH queries are allowed.");
    });
    it("rejects UPDATE statements", () => {
        expect(() => validateReadOnlySelectQuery("UPDATE products SET name = 'x'")).toThrow("Only SELECT queries and read-only WITH queries are allowed.");
    });
    it("rejects multiple statements", () => {
        expect(() => validateReadOnlySelectQuery("SELECT * FROM products; DROP TABLE customers;")).toThrow("Multiple SQL statements are not allowed.");
    });
    it("rejects forbidden keywords inside SELECT queries", () => {
        expect(() => validateReadOnlySelectQuery("SELECT * INTO temp_products FROM products")).toThrow("Forbidden SQL keyword detected: INTO");
    });
    it("rejects row-locking clauses", () => {
        expect(() => validateReadOnlySelectQuery("SELECT * FROM products FOR UPDATE")).toThrow("Row-locking clauses are not allowed.");
    });
    it("ignores forbidden keywords inside string literals", () => {
        const result = validateReadOnlySelectQuery("SELECT 'DROP TABLE products' AS warning");
        expect(result.sql).toBe("SELECT 'DROP TABLE products' AS warning");
    });
    it("ignores forbidden keywords inside line comments", () => {
        const result = validateReadOnlySelectQuery(`
      SELECT * FROM products
      -- DROP TABLE products
    `);
        expect(result.sql).toContain("SELECT * FROM products");
    });
    it("ignores forbidden keywords inside block comments", () => {
        const result = validateReadOnlySelectQuery(`
      SELECT * FROM products
      /* DELETE FROM products */
    `);
        expect(result.sql).toContain("SELECT * FROM products");
    });
    it("rejects SQL parameter placeholders", () => {
        expect(() => validateReadOnlySelectQuery("SELECT * FROM products WHERE id = $1")).toThrow("SQL parameter placeholders are not supported in user queries.");
    });
    it("rejects very long SQL", () => {
        const longSql = `SELECT '${"x".repeat(20_001)}'`;
        expect(() => validateReadOnlySelectQuery(longSql)).toThrow("SQL query is too long.");
    });
});
