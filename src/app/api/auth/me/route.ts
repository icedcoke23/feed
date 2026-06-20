import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, attachRenewedToken } from "@/lib/route-auth";
import { db } from "@/storage/database/drizzle-client";
import { users, teachers } from "@/storage/database/shared/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const authResult = await getAuthUser(request);

  if (!authResult) {
    return NextResponse.json(
      { error: "未登录或登录已过期", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const rows = await db
    .select({ id: users.id, username: users.username, name: users.name, role: users.role, phone: users.phone })
    .from(users)
    .where(eq(users.id, authResult.userId))
    .limit(1);
  const user = rows[0];

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  const userData: {
    id: string;
    username: string;
    name: string;
    role: string;
    phone: string | null;
    teacherRole?: string | null;
  } = { ...user };

  // 如果是 teacher 角色，关联查询 teachers 表获取 role
  if (user.role === "teacher") {
    const teacherRows = await db
      .select({ role: teachers.role })
      .from(teachers)
      .where(eq(teachers.id, user.id))
      .limit(1);
    if (teacherRows[0]) {
      userData.teacherRole = teacherRows[0].role;
    }
  }

  const response = NextResponse.json({
    data: {
      id: userData.id,
      username: userData.username,
      name: userData.name,
      role: userData.role,
      teacherRole: userData.teacherRole,
      phone: userData.phone,
    },
  });

  return attachRenewedToken(response, authResult);
}
