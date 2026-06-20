import { NextRequest } from "next/server";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { z } from "zod";
import { db } from "@/storage/database/drizzle-client";
import { users, teachers } from "@/storage/database/shared/schema";
import { eq, and } from "drizzle-orm";
import {
  signToken,
  COOKIE_NAME,
  isBcryptHash,
  comparePassword,
} from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";

const loginSchema = z.object({
  username: z.string().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码"),
});

export const POST = withDbError(
  withValidation(
    { body: loginSchema },
    async (req: NextRequest, { body }) => {
      const { username, password } = body as {
        username: string;
        password: string;
      };

      // 登录限流：每 IP 每分钟最多 5 次请求
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "unknown";
      const { allowed, retryAfterMs } = checkRateLimit(
        `login:${ip}`,
        5,
        60_000
      );
      if (!allowed) {
        return errorResponse(
          "请求过于频繁，请稍后再试",
          429,
          "RATE_LIMITED",
          { retryAfter: retryAfterMs / 1000 }
        );
      }

      const rows = await db
        .select()
        .from(users)
        .where(and(eq(users.username, username), eq(users.isActive, true)))
        .limit(1);

      const user = rows[0];
      if (!user) {
        return errorResponse("用户名或密码错误", 401, "INVALID_CREDENTIALS");
      }

      // 密码不是 bcrypt 哈希格式，拒绝登录
      if (!isBcryptHash(user.password)) {
        return errorResponse(
          "密码格式已过期，请联系管理员重置密码",
          401,
          "PASSWORD_FORMAT_EXPIRED"
        );
      }

      // 验证密码
      if (!(await comparePassword(password, user.password))) {
        return errorResponse("用户名或密码错误", 401, "INVALID_CREDENTIALS");
      }

      // 签发 JWT Token
      const token = await signToken({
        userId: user.id,
        role: user.role as "admin" | "teacher",
      });

      // 构造不含密码的用户信息
      const userInfo: Record<string, unknown> = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        phone: user.phone,
      };

      // 如果是 teacher 角色，关联查询 teachers 表获取 role
      if (user.role === "teacher") {
        const teacherRows = await db
          .select({ role: teachers.role })
          .from(teachers)
          .where(eq(teachers.id, user.id))
          .limit(1);
        if (teacherRows[0]) {
          userInfo.teacherRole = teacherRows[0].role;
        }
      }

      const response = successResponse(userInfo, "登录成功");
      response.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24,
        path: "/",
      });
      return response;
    }
  )
);
