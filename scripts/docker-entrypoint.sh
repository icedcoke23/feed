#!/bin/sh
set -e

# 等待 PostgreSQL 可用
echo "Waiting for postgres..."
# 使用环境变量分离的方式调用 pg_isready，避免 URL 中特殊字符导致解析失败
until pg_isready \
    -h "${POSTGRES_HOST:-postgres}" \
    -p "${POSTGRES_PORT:-5432}" \
    -U "${POSTGRES_USER:-postgres}" > /dev/null 2>&1; do
  sleep 1
done
echo "Postgres is ready"

# 执行数据库迁移
echo "Running database migrations..."
node ./node_modules/drizzle-kit/bin.cjs migrate || {
  echo "Database migration failed" >&2
  exit 1
}

# 启动 Next.js standalone 应用
echo "Starting application..."
exec node server.js
