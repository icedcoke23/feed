# 个性化教学反馈系统 - 部署指南

## 目录
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [方式一：Docker部署（推荐）](#方式一docker部署推荐)
- [方式二：Node.js直接运行](#方式二nodejs直接运行)
- [配置HTTPS和域名](#配置https和域名)
- [环境变量配置](#环境变量配置)
- [常用命令](#常用命令)
- [常见问题](#常见问题)

---

## 环境要求

### Docker部署
- Docker 20.10+
- Docker Compose 2.0+
- 至少 1GB 可用内存
- 至少 2GB 可用磁盘空间

### Node.js直接运行
- Node.js 18.17+ (推荐 20.x LTS)
- pnpm 9.0+
- 至少 512MB 可用内存

---

## 快速开始

### 一键部署（推荐）

```bash
# 1. 上传并解压项目
tar -xzf teaching-feedback-1.0.0.tar.gz
cd teaching-feedback-1.0.0

# 2. 配置环境变量
cp .env.example .env
vim .env  # 填写必要的环境变量

# 3. 一键部署
chmod +x deploy.sh
./deploy.sh

# 4. 访问应用
# http://your-server-ip:5000
```

---

## 方式一：Docker部署（推荐）

### 1. 上传项目文件

将整个项目目录上传到服务器，例如 `/opt/teaching-feedback/`

```bash
# 创建目录
sudo mkdir -p /opt/teaching-feedback
cd /opt/teaching-feedback

# 上传文件（使用scp、ftp或其他方式）
# scp -r ./projects/* user@server:/opt/teaching-feedback/
```

### 2. 配置环境变量

```bash
cd /opt/teaching-feedback

# 从模板创建环境变量文件
cp .env.example .env

# 编辑环境变量
vim .env
```

填写必要的环境变量（详见[环境变量配置](#环境变量配置)）。

### 3. 一键部署

```bash
# 添加执行权限
chmod +x deploy.sh

# 执行部署
./deploy.sh
```

### 4. 验证部署

```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 测试访问
curl http://localhost:5000
```

### 5. 开放端口

```bash
# 开放防火墙端口（如果需要）
sudo firewall-cmd --permanent --add-port=5000/tcp
sudo firewall-cmd --reload

# 或者使用阿里云安全组规则开放5000端口
```

---

## 方式二：Node.js直接运行

### 1. 安装Node.js

```bash
# 使用nvm安装Node.js 20
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# 或使用包管理器
# curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
# sudo yum install -y nodejs
```

### 2. 安装pnpm

```bash
npm install -g pnpm@9.0.0
```

### 3. 上传项目并安装依赖

```bash
cd /opt/teaching-feedback
pnpm install --frozen-lockfile
```

### 4. 配置环境变量

```bash
cp .env.example .env
vim .env
```

### 5. 构建项目

```bash
pnpm run build
```

### 6. 启动服务

```bash
# 直接启动
pnpm start

# 或使用PM2管理（推荐）
npm install -g pm2
pm2 start "pnpm start" --name teaching-feedback
pm2 save
pm2 startup
```

---

## 环境变量配置

### 必填项

```bash
# Supabase 数据库配置（必填）
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# AI SDK配置（必填，用于生成报告）
COZE_API_KEY=your_coze_api_key
```

### 可选项

```bash
# 对象存储配置（可选，用于文件上传）
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-southeast-1
S3_BUCKET_NAME=your_bucket_name

# 应用URL（可选）
NEXT_PUBLIC_APP_URL=http://your-server-ip:5000
```

---

## 常用命令

### Docker方式

```bash
# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 查看容器状态
docker-compose ps

# 进入容器
docker-compose exec teaching-feedback sh

# 更新部署
git pull
docker-compose build --no-cache
docker-compose up -d
```

### Node.js方式

```bash
# 查看PM2状态
pm2 status

# 查看日志
pm2 logs teaching-feedback

# 重启服务
pm2 restart teaching-feedback

# 停止服务
pm2 stop teaching-feedback

# 更新部署
git pull
pnpm install
pnpm build
pm2 restart teaching-feedback
```

---

## 配置HTTPS和域名

### 使用Nginx反向代理（推荐）

1. 安装Nginx
```bash
sudo yum install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

2. 安装Certbot（Let's Encrypt证书工具）
```bash
sudo yum install -y certbot python3-certbot-nginx
```

3. 配置Nginx
```bash
# 复制配置模板
sudo cp nginx.conf.example /etc/nginx/conf.d/teaching-feedback.conf

# 修改配置中的域名
sudo vim /etc/nginx/conf.d/teaching-feedback.conf
# 将 your-domain.com 替换为你的实际域名
```

4. 获取SSL证书
```bash
# 自动获取并配置证书
sudo certbot --nginx -d your-domain.com

# 或手动获取证书
sudo certbot certonly --nginx -d your-domain.com
```

5. 重启Nginx
```bash
sudo nginx -t  # 测试配置
sudo systemctl restart nginx
```

6. 设置自动续期
```bash
# 测试续期
sudo certbot renew --dry-run

# Certbot会自动设置定时任务续期
```

### 阿里云安全组配置

如果使用阿里云服务器，需要在安全组中开放端口：
- **80端口**：HTTP访问（用于证书验证）
- **443端口**：HTTPS访问
- **5000端口**：直接访问（可选，建议只开放80和443）

---

## 常见问题

### 1. 端口被占用

```bash
# 查看端口占用
netstat -tlnp | grep 5000

# 修改端口（修改docker-compose.yml中的ports配置）
ports:
  - "8080:5000"  # 将5000改为其他端口
```

### 2. 容器无法启动

```bash
# 查看详细日志
docker-compose logs

# 检查环境变量是否正确
docker-compose config
```

### 3. 数据库连接失败

检查Supabase配置是否正确：
- URL格式是否正确
- Anon Key是否有效
- 网络是否能访问Supabase服务

### 4. 内存不足

```bash
# 增加Node.js内存限制
NODE_OPTIONS="--max-old-space-size=2048" pnpm start
```

### 5. 无法访问服务

```bash
# 检查防火墙
sudo firewall-cmd --list-ports

# 检查服务是否运行
docker-compose ps
curl http://localhost:5000
```

---

## 生产环境建议

1. **使用HTTPS**: 配置Nginx反向代理和SSL证书
2. **设置备份**: 定期备份Supabase数据
3. **监控告警**: 使用PM2 Plus或Docker监控
4. **日志管理**: 配置日志轮转避免磁盘占满
5. **资源限制**: 在docker-compose.yml中设置资源限制

```yaml
services:
  teaching-feedback:
    # ... 其他配置
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

---

## 技术支持

如有问题，请检查：
1. 环境变量是否正确配置
2. 网络是否正常
3. 日志中的错误信息

---

**祝部署顺利！**
