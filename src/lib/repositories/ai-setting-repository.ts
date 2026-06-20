import { db } from "@/storage/database/drizzle-client";
import { aiSettings } from "@/storage/database/shared/schema";
import { eq } from "drizzle-orm";

export async function get() {
  const rows = await db.select().from(aiSettings).limit(1);
  return rows[0] ?? null;
}

export async function update(payload: Partial<typeof aiSettings.$inferInsert>) {
  const existing = await get();

  if (existing) {
    const rows = await db
      .update(aiSettings)
      .set({ ...payload, updatedAt: new Date() })
      .where(eq(aiSettings.id, existing.id))
      .returning();
    return rows[0];
  }

  const rows = await db
    .insert(aiSettings)
    .values({ ...payload, updatedAt: new Date() })
    .returning();
  return rows[0];
}
