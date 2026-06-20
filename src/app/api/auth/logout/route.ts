import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { COOKIE_NAME } from "@/lib/auth";
import { successResponse } from "@/lib/api-response";

export const POST = withDbError(
  withAuth(async () => {
    const response = successResponse(null, "登出成功");

    // 清除 auth_token Cookie
    response.cookies.set(COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  })
);
