# 部署指南 - Steam 评论抓取工具

本指南详细说明如何将本项目部署到一台空白的 **Debian 12** 服务器上。

## 1. 准备工作

确保你已经通过 SSH 登录到服务器。

### 更新系统软件包
```bash
sudo apt update && sudo apt upgrade -y
```

### 安装 Python 3 和 pip
Debian 12 默认包含 Python 3，但通常需要安装 pip 和 venv 模块。
```bash
sudo apt install python3 python3-pip python3-venv git -y
```

## 2. 获取代码

将项目上传到服务器。你可以使用 `git`（如果你的代码在仓库中）或 `scp`。
这里假设你将代码存放在 `~/steam_reviews` 目录。

```bash
mkdir -p ~/steam_reviews
cd ~/steam_reviews
# 上传你的代码文件 (app.py, steam_utils.py, requirements.txt) 到此目录
```

## 3. 设置虚拟环境

为了避免依赖冲突，建议使用 Python 虚拟环境。

```bash
# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate

# 升级 pip
pip install --upgrade pip
```

## 4. 安装依赖

在激活的虚拟环境中安装项目依赖。

```bash
pip install -r requirements.txt
```

## 5. 运行应用 (开发模式测试)

在正式部署前，先测试应用是否能正常运行。

```bash
streamlit run app.py --server.port 8501
```
如果一切正常，你可以按 `Ctrl+C` 停止运行。

## 6. 使用 Systemd 后台运行 (生产环境)

为了让应用在后台持续运行并在开机时自启，我们将创建一个 Systemd 服务。

### 创建服务文件

```bash
sudo nano /etc/systemd/system/steam-reviews.service
```

粘贴以下内容（**注意修改 `User` 和 `WorkingDirectory` 为你的实际用户名和路径**）：

```ini
[Unit]
Description=Steam Review Scraper
After=network.target

[Service]
User=root
WorkingDirectory=/root/steam_reviews
ExecStart=/root/steam_reviews/venv/bin/streamlit run app.py --server.port 80 --server.headless true
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```
*注：如果你不是 root 用户，请将 `User=root` 改为你的用户名（如 `User=admin`），并将路径 `/root/steam_reviews` 修改为 `/home/admin/steam_reviews`。同时端口如果使用 80 需要 root 权限，普通用户建议使用 8501。*

### 启动服务

```bash
# 重新加载配置
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start steam-reviews

# 设置开机自启
sudo systemctl enable steam-reviews
```

### 查看状态

```bash
sudo systemctl status steam-reviews
```

## 7. 配置防火墙 (可选)

如果服务器开启了防火墙，需要放行对应端口（这里以 80 端口为例）。

```bash
# 如果使用 ufw
sudo ufw allow 80/tcp
```

现在，你应该可以通过浏览器访问 `http://你的服务器IP` 来使用工具了！
