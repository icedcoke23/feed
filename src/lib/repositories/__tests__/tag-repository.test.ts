import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { createTestDb } from "@/test/db";
import * as tagRepo from "@/lib/repositories/tag-repository";
import { tags } from "@/storage/database/shared/schema";

describe("tag-repository", () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;
  let db: typeof testDb.drizzleDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    db = testDb.drizzleDb;
  });

  afterEach(async () => {
    await testDb.client.close();
  });

  test("create inserts a new tag", async () => {
    const created = await tagRepo.create(
      {
        id: "t1",
        category: "strength",
        name: "逻辑思维",
        description: "逻辑清晰",
        sortOrder: 1,
        isActive: true,
      },
      db
    );

    expect(created).toBeDefined();
    expect(created.category).toBe("strength");
    expect(created.name).toBe("逻辑思维");
  });

  test("findById returns created tag", async () => {
    await db.insert(tags).values({
      id: "t2",
      category: "improvement",
      name: "表达能力",
      isActive: true,
    });

    const tag = await tagRepo.findById("t2", db);

    expect(tag).toBeDefined();
    expect(tag?.name).toBe("表达能力");
  });

  test("findById returns null when tag does not exist", async () => {
    const tag = await tagRepo.findById("notfound", db);
    expect(tag).toBeNull();
  });
});
