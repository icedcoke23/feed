import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { sanitizeError, sanitizeErrorMessage } from "@/lib/sensitive-mask";

// 统一错误响应格式
export function apiError(message: string, status: number = 500, code?: string): NextResponse {
  return errorResponse(message, status, code);
}

// PostgreSQL 错误码到业务错误码的映射
// 参考 https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_ERROR_CODE_MAP: Record<string, { code: string; status: number; message: string }> = {
  "23505": { code: "UNIQUE_VIOLATION", status: 409, message: "记录已存在" },
  "23503": { code: "FOREIGN_KEY_VIOLATION", status: 400, message: "关联记录不存在" },
  "23514": { code: "CHECK_VIOLATION", status: 400, message: "数据不满足约束" },
  "23502": { code: "NOT_NULL_VIOLATION", status: 400, message: "必填字段缺失" },
  // 重复键冲突的另一种错误码（部分驱动用 23P01）
  "23P01": { code: "UNIQUE_VIOLATION", status: 409, message: "记录已存在" },
};

interface PgErrorLike {
  code?: string;
  constraint?: string;
  detail?: string;
  message?: string;
}

// 从错误对象中提取 PostgreSQL 错误码
function extractPgCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const e = error as PgErrorLike;
  // pg 库的错误对象在 error.code 上
  if (typeof e.code === "string" && /^\d{5}$/.test(e.code)) {
    return e.code;
  }
  return undefined;
}

// 数据库错误处理 - 识别 PostgreSQL 错误码并转换为业务错误码
export function handleDbError(error: unknown, context: string = "操作"): NextResponse {
  console.error(`[${context}] DB error:`, sanitizeError(error));

  // 优先识别 PostgreSQL 错误码
  const pgCode = extractPgCode(error);
  if (pgCode && PG_ERROR_CODE_MAP[pgCode]) {
    const mapping = PG_ERROR_CODE_MAP[pgCode];
    // 开发环境附带约束名等调试信息
    const details =
      process.env.NODE_ENV === "production"
        ? undefined
        : {
            constraint: (error as PgErrorLike).constraint,
            dbCode: pgCode,
          };
    return errorResponse(`${context}失败: ${mapping.message}`, mapping.status, mapping.code, details);
  }

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
  return apiError(message, 401, "UNAUTHORIZED");
}

// 权限不足错误
export function forbiddenError(message: string = "权限不足"): NextResponse {
  return apiError(message, 403, "FORBIDDEN");
}

// 资源未找到错误
export function notFoundError(message: string = "资源未找到"): NextResponse {
  return apiError(message, 404, "NOT_FOUND");
}

// 请求参数错误
export function badRequestError(message: string = "请求参数错误", details?: unknown): NextResponse {
  return errorResponse(message, 400, "BAD_REQUEST", details);
}
