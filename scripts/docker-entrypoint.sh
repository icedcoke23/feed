#!/bin/sh
set -e

# 等待 PostgreSQL 可用
echo "Waiting for postgres..."
until pg_isready -d "$DATABASE_URL" > /dev/null 2>&1; do
  sleep 1
done
echo "Postgres is ready"

# 执行数据库迁移
echo "Running database migrations..."
pnpm exec drizzle-kit migrate

# 启动 Next.js standalone 应用
echo "Starting application..."
exec node server.js
