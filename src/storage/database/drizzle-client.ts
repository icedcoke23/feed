import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./shared/schema";
import { sanitizeError } from "@/lib/sensitive-mask";
import type { Database } from "./types";

/**
 * PostgreSQL 连接池配置
 *
 * 针对教学反馈系统的中等并发场景优化：
 * - max: 10 个连接（适合中小型教育机构，单实例部署）
 * - idleTimeoutMillis: 30 秒空闲后关闭连接
 * - connectionTimeoutMillis: 2 秒连接超时
 * - maxUses: 单个连接最大使用次数（防止内存泄漏）
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  maxUses: 7500,
});

// 连接池错误处理（防止进程崩溃）
pool.on("error", (err) => {
  console.error("[DB] Unexpected error on idle client:", sanitizeError(err));
});

// 开发环境连接日志
if (process.env.NODE_ENV !== "production") {
  pool.on("connect", () => {
    // 仅在 DEBUG 模式下打印，避免日志噪音
    if (process.env.DEBUG_DB) {
      console.debug("[DB] New client connected");
    }
  });
}

export const db = drizzle(pool, { schema }) as Database;

/**
 * 事务辅助函数
 *
 * 统一事务处理逻辑，确保错误正确传播。
 * 所有需要在事务内执行的操作应使用此函数。
 *
 * @example
 * ```ts
 * const result = await withTransaction(async (tx) => {
 *   const a = await tx.insert(tableA).values(...).returning();
 *   const b = await tx.insert(tableB).values(...).returning();
 *   return { a, b };
 * });
 * ```
 */
export async function withTransaction<T>(
  fn: (tx: Database) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tx = drizzle(client, { schema }) as Database;
    const result = await fn(tx);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 数据库健康检查
 *
 * 用于健康检查端点和启动时验证连接。
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      return true;
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
}

/**
 * 关闭连接池（用于优雅关闭）
 */
export async function closePool(): Promise<void> {
  await pool.end();
}

export { pool };
