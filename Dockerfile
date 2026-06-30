# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN apk add --no-cache postgresql-client

FROM base AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# 迁移工具镜像：仅安装迁移所需的 prod 依赖 + drizzle-kit
FROM base AS migrator
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# drizzle-kit 在 devDependencies，需显式安装
RUN pnpm install --prod --frozen-lockfile && pnpm add drizzle-kit@0.31.8 pg@8.16.3

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# standalone 产物（含运行时依赖）
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/src/storage/database/migrations ./src/storage/database/migrations

# 迁移工具：从 migrator 阶段复制 drizzle-kit 及其依赖
COPY --from=migrator /app/node_modules ./node_modules

RUN chmod +x ./scripts/docker-entrypoint.sh

# 非 root 用户运行
USER node

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 健康检查端点
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health > /dev/null 2>&1 || exit 1

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
