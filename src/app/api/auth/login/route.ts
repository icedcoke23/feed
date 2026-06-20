import { NextRequest } from "next/server";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { z } from "zod";
import { signToken, COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { authService } from "@/lib/services";

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

      const result = await authService.login({ username, password });
      if (result instanceof Response) return result;

      const token = await signToken({
        userId: result.user.id,
        role: result.user.role as "admin" | "teacher",
      });

      const response = successResponse(result.user, "登录成功");
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
