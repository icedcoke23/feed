import { NextRequest } from "next/server";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { db } from "@/storage/database/drizzle-client";
import { users, teachers } from "@/storage/database/shared/schema";
import { eq } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api-response";

export const GET = withDbError(
  withAuth(async (req: NextRequest, { authUser }) => {
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, authUser!.userId))
      .limit(1);
    const user = userRows[0];
    if (!user) {
      return errorResponse("用户不存在", 404);
    }

    let teacherRole: string | undefined;
    if (authUser!.userRole === "teacher") {
      const teacherRows = await db
        .select({ role: teachers.role })
        .from(teachers)
        .where(eq(teachers.id, authUser!.userId))
        .limit(1);
      teacherRole = teacherRows[0]?.role;
    }

    return successResponse({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      phone: user.phone,
      teacherRole,
    });
  })
);
