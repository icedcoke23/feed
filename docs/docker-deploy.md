# Docker 部署指南

## 环境要求

- Docker Engine >= 24.0
- Docker Compose >= 2.20

## 快速启动

1. 克隆项目并进入目录

```bash
cd /workspace
```

2. 启动服务

```bash
docker compose up --build -d
```

3. 等待数据库迁移完成并访问

```bash
# 查看日志
docker compose logs -f app
```

访问 http://localhost:3000

## 默认账号

- 用户名：`admin`
- 密码：环境变量 `ADMIN_DEFAULT_PASSWORD` 的值，如未设置则随机生成，请查看容器日志获取

```bash
docker compose logs app | grep "管理员账户"
```

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `DATABASE_URL` | 否 | 自动配置 | PostgreSQL 连接字符串 |
| `JWT_SECRET` | 是 | `change-me-in-production` | JWT 签名密钥，生产环境必须修改 |
| `ADMIN_DEFAULT_PASSWORD` | 否 | 随机生成 | 管理员默认密码 |
| `NEXT_PUBLIC_APP_URL` | 否 | `http://localhost:3000` | 应用公网地址 |
| `COZE_API_KEY` | 否 | - | AI 报告生成 API Key |

## 生产环境建议

1. 修改 `JWT_SECRET` 为强随机字符串
2. 设置 `ADMIN_DEFAULT_PASSWORD` 并记录
3. 修改 `docker-compose.yml` 中的 PostgreSQL 默认密码
4. 使用外部 PostgreSQL 时，移除 `postgres` 服务并配置 `DATABASE_URL`
5. 配置反向代理（Nginx / Traefik）并启用 HTTPS
6. 定期备份 PostgreSQL 数据卷

## 常用命令

```bash
# 停止服务
docker compose down

# 停止并删除数据卷（谨慎）
docker compose down -v

# 查看日志
docker compose logs -f

# 重新构建
docker compose up --build -d
```
