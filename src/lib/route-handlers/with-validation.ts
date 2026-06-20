import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { errorResponse } from "@/lib/api-response";
import type { RouteHandler, RouteContext, ValidationSchemas } from "./types";

export function withValidation<T>(
  schemas: ValidationSchemas,
  handler: RouteHandler<T>
) {
  return async (
    req: NextRequest,
    ctx: RouteContext
  ): Promise<T | Response> => {
    try {
      const validated: RouteContext = { ...ctx };

      if (schemas.params && ctx.params) {
        validated.params = schemas.params.parse(ctx.params);
      }

      if (schemas.query) {
        const { searchParams } = new URL(req.url);
        const obj: Record<string, string | string[]> = {};
        searchParams.forEach((value, key) => {
          const existing = obj[key];
          if (existing) {
            obj[key] = Array.isArray(existing)
              ? [...existing, value]
              : [existing, value];
          } else {
            obj[key] = value;
          }
        });
        validated.query = schemas.query.parse(obj);
      }

      if (schemas.body && req.method !== "GET" && req.method !== "HEAD") {
        const json = await req.json();
        validated.body = schemas.body.parse(json);
      }

      return await handler(req, validated);
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        }));
        return errorResponse("请求参数错误", 400, "VALIDATION_ERROR", {
          details,
        });
      }
      throw error;
    }
  };
}
