import { NextResponse } from "next/server";
import { healthCheck } from "@/storage/database/drizzle-client";

// GET /api/health - 健康检查端点（不需要认证，用于 Docker HEALTHCHECK 和负载均衡探活）
export async function GET() {
  try {
    const dbOk = await healthCheck();
    if (!dbOk) {
      return NextResponse.json(
        { status: "unhealthy", database: "down" },
        { status: 503 }
      );
    }
    return NextResponse.json({ status: "healthy", database: "up" });
  } catch {
    return NextResponse.json(
      { status: "unhealthy", database: "error" },
      { status: 503 }
    );
  }
}
