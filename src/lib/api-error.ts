import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { sanitizeError, sanitizeErrorMessage } from "@/lib/sensitive-mask";

// 统一错误响应格式
export function apiError(message: string, status: number = 500, code?: string): NextResponse {
  return errorResponse(message, status, code);
}

// 数据库错误处理 - 生产环境不暴露内部错误详情
export function handleDbError(error: unknown, context: string = "操作"): NextResponse {
  console.error(`[${context}] DB error:`, sanitizeError(error));

  if (process.env.NODE_ENV === "production") {
    return apiError(`${context}失败，请稍后重试`, 500);
  }

  const message = sanitizeError(error);

  // 针对常见 schema 缺失给出可操作的提示
  if (message.includes("Could not find the 'metadata' column") || message.includes("in the schema cache")) {
    return apiError(
      `${context}失败: 数据库表缺少 metadata 列或 PostgreSQL schema 未刷新。请在本地数据库执行 schema 迁移。`,
      500
    );
  }

  return apiError(`${context}失败: ${sanitizeErrorMessage(message)}`, 500);
}

// 未认证错误
export function unauthorizedError(message: string = "请先登录"): NextResponse {
  return apiError(message, 401);
}

// 权限不足错误
export function forbiddenError(message: string = "权限不足"): NextResponse {
  return apiError(message, 403);
}

// 资源未找到错误
export function notFoundError(message: string = "资源未找到"): NextResponse {
  return apiError(message, 404);
}

// 请求参数错误
export function badRequestError(message: string = "请求参数错误", details?: unknown): NextResponse {
  return errorResponse(message, 400, undefined, details);
}
