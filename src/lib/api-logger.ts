import { NextRequest, NextResponse } from "next/server";

type HandlerFunction = (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse | Response>;

/**
 * 包装 API 路由 handler，自动记录请求日志
 * 格式：[API] METHOD /path - STATUS - Xms
 * 只记录 /api/ 路径的请求
 */
export function withLogging(handler: HandlerFunction): HandlerFunction {
  return async (request, context) => {
    const { method } = request;
    const path = new URL(request.url).pathname;

    // 非 API 路径不记录日志
    if (!path.startsWith("/api/")) {
      return handler(request, context);
    }

    const start = Date.now();

    try {
      const response = await handler(request, context);
      const duration = Date.now() - start;
      const status = response.status;

      console.log(`[API] ${method} ${path} - ${status} - ${duration}ms`);

      return response;
    } catch (error) {
      const duration = Date.now() - start;
      console.log(`[API] ${method} ${path} - 500 - ${duration}ms`);
      throw error;
    }
  };
}
