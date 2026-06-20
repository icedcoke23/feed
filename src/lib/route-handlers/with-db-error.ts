import { NextRequest, NextResponse } from "next/server";
import { handleDbError } from "@/lib/api-error";
import type { RouteHandler, RouteContext } from "./types";

export function withDbError<T>(handler: RouteHandler<T>) {
  return async (
    req: NextRequest,
    ctx: RouteContext
  ): Promise<T | NextResponse> => {
    try {
      const result = await handler(req, ctx);
      if (result instanceof Response || result instanceof NextResponse) {
        return result;
      }
      return NextResponse.json(result);
    } catch (error) {
      return handleDbError(error, req.nextUrl.pathname);
    }
  };
}
