import { describe, expect, it } from "vitest";
import { createTestDb } from "./db";

describe("test infrastructure smoke tests", () => {
  it("createTestDb returns a drizzle db", () => {
    const { drizzleDb } = createTestDb();
    expect(drizzleDb).toBeDefined();
  });

  it("crypto.randomUUID is mocked to return test-uuid-1", () => {
    expect(crypto.randomUUID()).toBe("test-uuid-1");
  });
});
