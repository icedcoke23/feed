import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";

export function apiError(message: string, status: number = 500, code?: string): NextResponse {
  return errorResponse(message, status, code);
}

function isPostgresError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}

export function handleDbError(error: unknown, context: string = "操作"): NextResponse {
  console.error(`[${context}] DB error:`, error);

  if (isPostgresError(error)) {
    switch (error.code) {
      case "23505":
        return apiError(`${context}失败：记录已存在`, 409, "UNIQUE_VIOLATION");
      case "23503":
        return apiError(`${context}失败：关联记录不存在`, 400, "FOREIGN_KEY_VIOLATION");
      case "23514":
        return apiError(`${context}失败：数据不满足约束`, 400, "CHECK_VIOLATION");
    }
  }

  if (process.env.NODE_ENV === "production") {
    return apiError(`${context}失败，请稍后重试`, 500);
  }

  const message = error instanceof Error ? error.message : "未知错误";
  return apiError(`${context}失败: ${message}`, 500);
}

export function unauthorizedError(message: string = "请先登录"): NextResponse {
  return apiError(message, 401, "UNAUTHORIZED");
}

export function forbiddenError(message: string = "权限不足"): NextResponse {
  return apiError(message, 403, "FORBIDDEN");
}

export function notFoundError(message: string = "资源未找到"): NextResponse {
  return apiError(message, 404, "NOT_FOUND");
}

export function badRequestError(message: string = "请求参数错误"): NextResponse {
  return apiError(message, 400, "BAD_REQUEST");
}
