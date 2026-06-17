# 个性化教学反馈系统 - Dockerfile
# 多阶段构建，优化镜像大小

# 阶段1: 依赖安装
FROM node:20-alpine AS deps
WORKDIR /app

# 安装pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# 复制package文件
COPY package.json pnpm-lock.yaml* ./

# 安装依赖
RUN pnpm install --frozen-lockfile --prefer-offline

# 阶段2: 构建
FROM node:20-alpine AS builder
WORKDIR /app

# 安装pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 构建应用
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm run build

# 阶段3: 运行
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5000
ENV HOSTNAME="0.0.0.0"

# 创建非root用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 设置权限
RUN chown -R nextjs:nodejs /app

# 切换用户
USER nextjs

# 暴露端口
EXPOSE 5000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000 || exit 1

# 启动应用
CMD ["node", "server.js"]
