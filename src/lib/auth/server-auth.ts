import { cookies } from "next/headers";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";
import { db } from "@/storage/database/drizzle-client";
import { teachers } from "@/storage/database/shared/schema";
import { eq } from "drizzle-orm";
import type { AuthUserResult } from "@/lib/route-auth";

export async function verifyAuth(): Promise<AuthUserResult | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  let teacherRole: "admin" | "teacher" | undefined;
  if (payload.role === "teacher") {
    const rows = await db
      .select({ role: teachers.role })
      .from(teachers)
      .where(eq(teachers.id, payload.userId))
      .limit(1);
    teacherRole = (rows[0]?.role as "admin" | "teacher") || "teacher";
  }

  return { userId: payload.userId, userRole: payload.role, teacherRole };
}
