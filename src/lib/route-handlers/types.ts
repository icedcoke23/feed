import type { NextRequest } from "next/server";
import type { ZodSchema } from "zod";
import type { AuthUserResult } from "@/lib/route-auth";

export interface ValidationSchemas {
  params?: ZodSchema;
  query?: ZodSchema;
  body?: ZodSchema;
}

export interface RouteContext {
  authUser?: AuthUserResult;
  params?: unknown;
  query?: unknown;
  body?: unknown;
}

export type RouteHandler<T = Response> = (
  req: NextRequest,
  ctx: RouteContext
) => T | Promise<T>;
