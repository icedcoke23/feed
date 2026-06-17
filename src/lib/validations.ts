import { ZodSchema } from "zod";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";

// 校验 API 输入，返回校验后的数据或错误响应
export function validateInput<T>(schema: ZodSchema<T>, data: unknown): { data: T } | { error: NextResponse } {
  try {
    const validated = schema.parse(data);
    return { data: validated };
  } catch (error: unknown) {
    // Zod v4 使用 issues 属性，v3 使用 errors 属性
    const zodError = error as { issues?: Array<{ message?: string }>; errors?: Array<{ message?: string }> };
    const issues = zodError.issues || zodError.errors;
    if (issues && Array.isArray(issues) && issues.length > 0) {
      const message = issues[0].message || "输入数据格式错误";
      return { error: errorResponse(message, 400) };
    }
    // 其他错误
    const message = error instanceof Error ? error.message : "输入数据格式错误";
    return { error: errorResponse(message, 400) };
  }
}
