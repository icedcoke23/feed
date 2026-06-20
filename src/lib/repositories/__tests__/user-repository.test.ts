import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { createTestDb } from "@/test/db";
import * as userRepo from "@/lib/repositories/user-repository";
import { users } from "@/storage/database/shared/schema";

describe("user-repository", () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;
  let db: typeof testDb.drizzleDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    db = testDb.drizzleDb;
    await db.delete(users);
  });

  afterEach(async () => {
    await testDb.client.close();
  });

  test("findByUsername returns user after insertion", async () => {
    await db.insert(users).values({
      id: "u1",
      username: "alice",
      name: "Alice",
      password: "hash",
      role: "teacher",
      isActive: true,
    });

    const user = await userRepo.findByUsername("alice", db);

    expect(user).toBeDefined();
    expect(user?.name).toBe("Alice");
    expect(user?.username).toBe("alice");
  });

  test("findByUsername returns null when user does not exist", async () => {
    const user = await userRepo.findByUsername("notfound", db);
    expect(user).toBeNull();
  });

  test("create inserts a new user", async () => {
    const created = await userRepo.create(
      {
        id: "u2",
        username: "bob",
        name: "Bob",
        password: "hash",
        role: "admin",
        isActive: true,
      },
      db
    );

    expect(created).toBeDefined();
    expect(created.username).toBe("bob");

    const found = await userRepo.findByUsername("bob", db);
    expect(found?.name).toBe("Bob");
  });
});
