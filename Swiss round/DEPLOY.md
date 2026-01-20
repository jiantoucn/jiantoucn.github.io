# 部署指南 - Debian 服务器

本文档将指导你如何从零开始在 Debian 服务器上部署 **Swiss Round Calculator** 项目。

## 1. 基础环境准备

首先，更新系统并安装必要的工具：

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx build-essential
```

## 2. 安装 Node.js (推荐使用 nvm)

安装 nvm (Node Version Manager) 来管理 Node.js 版本：

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# 安装完成后，重新加载配置文件
source ~/.bashrc
# 安装最新的 LTS 版本 Node.js
nvm install --lts
nvm use --lts
```

## 3. 获取代码并安装依赖

```bash
git clone <你的项目仓库地址>
cd swiss-round
npm install
```

## 4. 构建项目

生成用于生产环境的静态文件：

```bash
npm run build
```

构建完成后，所有的静态文件将位于 `dist/` 目录下。

## 5. 配置 Nginx

创建一个新的 Nginx 配置文件：

```bash
sudo nano /etc/nginx/sites-available/swiss-round
```

将以下内容粘贴进去（注意修改 `server_name` 和 `root` 路径）：

```nginx
server {
    listen 80;
    server_name your_domain_or_ip; # 替换为你的域名或 IP 地址

    root /var/www/swiss-round/dist; # 替换为你项目的实际构建路径
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 开启 Gzip 压缩以提高性能
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

启用该配置并重启 Nginx：

```bash
sudo ln -s /etc/nginx/sites-available/swiss-round /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 6. 配置防火墙 (可选)

如果你开启了 ufw 防火墙，请允许 HTTP 访问：

```bash
sudo ufw allow 'Nginx Full'
```

## 7. 自动部署脚本 (可选)

你可以使用项目中提供的 `deploy.sh` 脚本来简化后续的更新流程。

---

祝部署顺利！如有问题，请检查 Nginx 日志：`sudo tail -f /var/log/nginx/error.log`
