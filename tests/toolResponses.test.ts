import { describe, expect, it } from "vitest";

import {
  createErrorEnvelope,
  createErrorToolResponse,
  createSuccessEnvelope,
  createSuccessToolResponse,
} from "../src/tools/response.js";

describe("tool response helpers", () => {
  it("creates a success envelope with summary and data", () => {
    expect(createSuccessEnvelope("Listed 1 schema.", [{ schemaName: "public" }])).toEqual({
      ok: true,
      summary: "Listed 1 schema.",
      data: [{ schemaName: "public" }],
    });
  });

  it("creates an error envelope with summary and message", () => {
    expect(createErrorEnvelope("Failed to list schemas.", "connection refused")).toEqual({
      ok: false,
      summary: "Failed to list schemas.",
      error: {
        message: "connection refused",
      },
    });
  });

  it("serializes success tool responses as JSON envelopes", () => {
    expect(createSuccessToolResponse("Server is reachable.", { message: "pong" })).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ok: true,
              summary: "Server is reachable.",
              data: { message: "pong" },
            },
            null,
            2,
          ),
        },
      ],
    });
  });

  it("serializes error tool responses as JSON envelopes", () => {
    expect(createErrorToolResponse("Query rejected or failed.", "Row-locking clauses are not allowed.")).toEqual({
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ok: false,
              summary: "Query rejected or failed.",
              error: {
                message: "Row-locking clauses are not allowed.",
              },
            },
            null,
            2,
          ),
        },
      ],
    });
  });
});
