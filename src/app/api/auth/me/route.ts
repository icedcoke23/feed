import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, attachRenewedToken } from "@/lib/route-auth";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";

export async function GET(request: NextRequest) {
  const authResult = await getAuthUser(request);

  if (!authResult) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const client = getServerSupabaseClient();
  const { data, error } = await client
    .from("users")
    .select("id, username, name, role, phone")
    .eq("id", authResult.userId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  // 如果是 teacher 角色，关联查询 teachers 表获取 role
  if (data.role === "teacher") {
    const { data: teacherData } = await client
      .from("teachers")
      .select("role")
      .eq("id", data.id)
      .single();
    if (teacherData) {
      (data as any).teacherRole = teacherData.role;
    }
  }

  const response = NextResponse.json({
    user: {
      id: data.id,
      username: data.username,
      name: data.name,
      role: data.role,
      teacherRole: (data as any).teacherRole,
      phone: data.phone,
    },
  });

  return attachRenewedToken(response, authResult);
}
