#!/bin/bash

# 个性化教学反馈系统 - 部署脚本
# 适用于 Alibaba Cloud 3 服务器

set -e

echo "=========================================="
echo "  个性化教学反馈系统 - 部署脚本"
echo "=========================================="

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "错误: Docker未安装，请先安装Docker"
    echo "安装命令: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

# 检查Docker Compose是否安装
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "错误: Docker Compose未安装"
    exit 1
fi

# 检查.env文件是否存在
if [ ! -f ".env" ]; then
    echo "警告: .env文件不存在，正在从模板创建..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "已创建.env文件，请编辑并填写正确的环境变量"
        echo "编辑命令: vim .env"
        exit 1
    else
        echo "错误: .env.example文件不存在"
        exit 1
    fi
fi

# 构建Docker镜像
echo ""
echo ">>> 构建Docker镜像..."
docker-compose build --no-cache

# 停止旧容器
echo ""
echo ">>> 停止旧容器..."
docker-compose down

# 启动新容器
echo ""
echo ">>> 启动新容器..."
docker-compose up -d

# 检查服务状态
echo ""
echo ">>> 等待服务启动..."
sleep 5

if docker-compose ps | grep -q "Up"; then
    echo ""
    echo "=========================================="
    echo "  部署成功！"
    echo "=========================================="
    echo ""
    echo "服务地址: http://localhost:5000"
    echo ""
    echo "常用命令:"
    echo "  查看日志:   docker-compose logs -f"
    echo "  停止服务:   docker-compose down"
    echo "  重启服务:   docker-compose restart"
    echo "  查看状态:   docker-compose ps"
    echo ""
else
    echo ""
    echo "=========================================="
    echo "  部署可能失败，请检查日志"
    echo "=========================================="
    echo ""
    docker-compose logs
    exit 1
fi
