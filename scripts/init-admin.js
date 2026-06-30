/**
 * CI/开发环境初始化 admin 账户
 *
 * 用途：
 * - CI E2E 测试前调用，确保存在可用 admin 账户
 * - 本地开发首次启动时调用
 *
 * 行为：
 * - 若 admin 用户已存在则跳过
 * - 否则创建 admin 用户（密码来自 ADMIN_DEFAULT_PASSWORD 或默认 "admin123"）
 *
 * 运行：node scripts/init-admin.js
 * 环境变量：DATABASE_URL、ADMIN_DEFAULT_PASSWORD（可选）
 */

const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("错误：DATABASE_URL 未设置");
    process.exit(1);
  }

  const password = process.env.ADMIN_DEFAULT_PASSWORD || "admin123";
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const existing = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      ["admin"]
    );

    if (existing.rows.length > 0) {
      console.log("✓ admin 账户已存在，跳过");
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO users (id, username, name, password, role, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [id, "admin", "管理员", hashedPassword, "admin", true]
    );

    console.log("✓ admin 账户已创建 (用户名: admin)");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("初始化失败:", err);
  process.exit(1);
});
