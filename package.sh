#!/bin/bash

# 打包脚本 - 用于打包项目以便上传到服务器

set -e

VERSION="1.0.0"
PACKAGE_NAME="teaching-feedback-${VERSION}"
OUTPUT_DIR="dist"

echo "=========================================="
echo "  打包个性化教学反馈系统"
echo "=========================================="

# 清理旧的打包文件
echo ">>> 清理旧的打包文件..."
rm -rf ${OUTPUT_DIR}
rm -f ${PACKAGE_NAME}.tar.gz

# 创建输出目录
mkdir -p ${OUTPUT_DIR}/${PACKAGE_NAME}

# 复制必要文件
echo ">>> 复制项目文件..."
cp -r src ${OUTPUT_DIR}/${PACKAGE_NAME}/
cp -r public ${OUTPUT_DIR}/${PACKAGE_NAME}/
cp package.json ${OUTPUT_DIR}/${PACKAGE_NAME}/
cp pnpm-lock.yaml ${OUTPUT_DIR}/${PACKAGE_NAME}/
cp next.config.ts ${OUTPUT_DIR}/${PACKAGE_NAME}/
cp tsconfig.json ${OUTPUT_DIR}/${PACKAGE_NAME}/
cp postcss.config.mjs ${OUTPUT_DIR}/${PACKAGE_NAME}/
cp components.json ${OUTPUT_DIR}/${PACKAGE_NAME}/
cp Dockerfile ${OUTPUT_DIR}/${PACKAGE_NAME}/
cp docker-compose.yml ${OUTPUT_DIR}/${PACKAGE_NAME}/
cp deploy.sh ${OUTPUT_DIR}/${PACKAGE_NAME}/
cp DEPLOY.md ${OUTPUT_DIR}/${PACKAGE_NAME}/
cp .env.example ${OUTPUT_DIR}/${PACKAGE_NAME}/
cp .dockerignore ${OUTPUT_DIR}/${PACKAGE_NAME}/
cp eslint.config.mjs ${OUTPUT_DIR}/${PACKAGE_NAME}/ 2>/dev/null || true

# 复制其他必要配置文件
cp -r components ${OUTPUT_DIR}/${PACKAGE_NAME}/ 2>/dev/null || true
cp -r lib ${OUTPUT_DIR}/${PACKAGE_NAME}/ 2>/dev/null || true
cp -r hooks ${OUTPUT_DIR}/${PACKAGE_NAME}/ 2>/dev/null || true
cp -r types ${OUTPUT_DIR}/${PACKAGE_NAME}/ 2>/dev/null || true
cp -r styles ${OUTPUT_DIR}/${PACKAGE_NAME}/ 2>/dev/null || true
cp -r drizzle ${OUTPUT_DIR}/${PACKAGE_NAME}/ 2>/dev/null || true

# 复制drizzle配置（如果存在）
cp drizzle.config.ts ${OUTPUT_DIR}/${PACKAGE_NAME}/ 2>/dev/null || true

# 创建空的node_modules占位符（告诉用户需要安装依赖）
mkdir -p ${OUTPUT_DIR}/${PACKAGE_NAME}/node_modules
echo "# 请运行 pnpm install 安装依赖" > ${OUTPUT_DIR}/${PACKAGE_NAME}/node_modules/README.md

# 打包
echo ">>> 创建压缩包..."
cd ${OUTPUT_DIR}
tar -czf ../${PACKAGE_NAME}.tar.gz ${PACKAGE_NAME}
cd ..

# 计算文件大小
SIZE=$(du -h ${PACKAGE_NAME}.tar.gz | cut -f1)

echo ""
echo "=========================================="
echo "  打包完成！"
echo "=========================================="
echo ""
echo "打包文件: ${PACKAGE_NAME}.tar.gz"
echo "文件大小: ${SIZE}"
echo ""
echo "部署步骤:"
echo "1. 上传 ${PACKAGE_NAME}.tar.gz 到服务器"
echo "2. 解压: tar -xzf ${PACKAGE_NAME}.tar.gz"
echo "3. 进入目录: cd ${PACKAGE_NAME}"
echo "4. 配置环境变量: cp .env.example .env && vim .env"
echo "5. 部署: chmod +x deploy.sh && ./deploy.sh"
echo ""
