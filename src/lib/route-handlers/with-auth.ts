import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, attachRenewedToken } from "@/lib/route-auth";
import { unauthorizedError } from "@/lib/api-error";
import type { RouteHandler, RouteContext } from "./types";

export function withAuth<T>(handler: RouteHandler<T>) {
  return async (
    req: NextRequest,
    ctx: RouteContext
  ): Promise<T | NextResponse> => {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return unauthorizedError();
    }
    const result = await handler(req, { ...ctx, authUser });
    if (result instanceof NextResponse && authUser.newToken) {
      return attachRenewedToken(result, authUser);
    }
    return result;
  };
}
