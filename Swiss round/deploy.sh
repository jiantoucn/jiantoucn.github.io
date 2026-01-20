#!/bin/bash

# 自动化部署脚本

echo "开始自动部署流程..."

# 1. 拉取最新代码
echo "正在拉取最新代码..."
git pull origin main

# 2. 安装依赖
echo "正在安装依赖..."
npm install

# 3. 执行构建
echo "正在进行生产环境构建..."
npm run build

# 4. 确保目标目录存在
echo "正在配置 web 目录..."
sudo mkdir -p /var/www/swiss-round
sudo cp -r dist/* /var/www/swiss-round/

# 5. 检查 Nginx 配置并重启
echo "正在检查 Nginx 配置..."
sudo nginx -t
if [ $? -eq 0 ]; then
    echo "Nginx 配置正确，正在重启服务..."
    sudo systemctl restart nginx
    echo "部署成功！"
else
    echo "Nginx 配置错误，请检查！"
    exit 1
fi
