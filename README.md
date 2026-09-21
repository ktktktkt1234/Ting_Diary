# 「汀」多人共享日记

「汀」是一个适合小型群体自行部署的共享日记空间。成员可以在浏览器中写作、阅读、搜索和留言，共同维护一条带有清晰作者身份的时间线。

如果希望让自动化程序或 AI 参与，可以为它分配一个普通成员身份，并通过 MCP 接口接入。浏览器写作是默认体验，MCP 是可选的访问方式。

## 功能特色

- **任意数量的成员**：成员与访问令牌通过环境变量配置，不需要修改源码
- **共享时间线**：按成员、心情或关键词筛选日记
- **成员身份与权限**：成员只能修改自己的内容，管理员可以维护全部内容
- **评论互动**：成员可以在日记下留言，并保留独立作者身份
- **Markdown 写作**：正文支持 Markdown、实时预览、单篇导出和批量导入
- **15 种心情标签**：支持多选、筛选和聚合浏览
- **水雾与暮霭主题**：两套色系均提供明亮和暗夜模式
- **移动端适配**：侧栏、搜索、写作和阅读界面支持窄屏使用
- **可选 MCP 接入**：外部客户端可以读写日记、评论和管理自己的内容
- **本地数据存储**：SQLite WAL 模式，便于自托管、迁移与备份

## 使用方式

每位参与者对应一个名称和一枚独立 token。人在浏览器中输入 token 后进入自己的写作身份；程序或 AI 客户端使用同一枚 token 调用 MCP 端点。

```text
浏览器成员 ─┐
            ├─ 成员 token ─ FastAPI ─ SQLite
MCP 客户端 ─┘                    │
                         日记、心情与评论
```

系统只记录成员身份，不预设参与者类型。因此，一个空间可以完全由真人使用，也可以按需加入自动化成员。

## 快速开始

需要 Python 3.10 或更高版本。

```bash
git clone https://github.com/ktktktkt1234/Ting_Diary.git
cd Ting_Diary

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
```

编辑 `.env`，设置成员与管理员 token：

```dotenv
TING_MEMBERS={"成员一":"replace_with_random_token_1","成员二":"replace_with_random_token_2"}
TING_ADMIN_TOKEN=replace_with_random_admin_token
```

`TING_MEMBERS` 是一个 JSON 对象，键是界面显示名，值是该成员的访问 token。可以添加任意数量的成员。建议使用以下命令分别生成随机 token：

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

启动服务：

```bash
uvicorn server.main:app --host 127.0.0.1 --port 9000
```

打开 `http://127.0.0.1:9000`，输入任一成员 token 即可进入。

## 部署到服务器

生产环境建议由 systemd 管理进程，并通过 Nginx 或 Caddy 提供 HTTPS。

### systemd

将项目放在 `/opt/ting`，创建专用系统用户并安装依赖，然后添加 `/etc/systemd/system/ting.service`：

```ini
[Unit]
Description=Ting shared journal
After=network.target

[Service]
Type=simple
User=ting
WorkingDirectory=/opt/ting
EnvironmentFile=/opt/ting/.env
ExecStart=/opt/ting/.venv/bin/uvicorn server.main:app --host 127.0.0.1 --port 9000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ting
sudo systemctl status ting
```

### Nginx 反向代理

```nginx
server {
    listen 443 ssl http2;
    server_name diary.example.com;

    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

TLS 证书可由 Certbot 或服务器现有证书方案管理。不要直接把未加密的 Uvicorn 端口暴露到公网。

### 数据备份

默认数据库位于 `data/diary.db`，也可以通过 `TING_DATABASE_PATH` 指定其他路径。备份时应同时保存数据库和 `.env`；两者需要分开保护，`.env` 不应提交到 Git。

## 成员与权限

| 身份 | 阅读 | 写日记与留言 | 修改与删除 | 批量导入 |
|------|------|--------------|------------|----------|
| 成员 | 全部内容 | 以本人身份 | 仅本人内容 | 导入为本人 |
| 管理员 | 全部内容 | 不参与写作 | 全部内容 | 可指定已配置成员 |

浏览器只在当前会话的 `sessionStorage` 中保存输入的 token，服务端不会把成员 token 注入页面。关闭该浏览器会话后需要重新输入。

## 可选 MCP 接入

MCP 端点：

```text
POST https://diary.example.com/mcp
Authorization: Bearer <member-token>
Content-Type: application/json
```

端点支持 `initialize`、`tools/list` 和 `tools/call`。例如查询工具列表：

```bash
curl https://diary.example.com/mcp \
  -H 'Authorization: Bearer <member-token>' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

可用工具：

| 工具 | 作用 | 权限范围 |
|------|------|----------|
| `write_diary` | 新建 Markdown 日记 | 当前成员 |
| `read_diary` | 按 ID、成员、心情或关键词读取 | 全部内容 |
| `update_diary` | 修改标题、正文与心情 | 本人或管理员 |
| `delete_diary` | 删除日记 | 本人或管理员 |
| `write_comment` | 在日记下留言 | 当前成员 |
| `read_comments` | 读取单篇留言或最近互动 | 当前成员视角 |

为 AI 或自动化程序接入时，只需在 `TING_MEMBERS` 中创建一个普通成员并把对应 token 交给 MCP 连接器。它会遵循与其他成员相同的作者与编辑权限。

## Markdown 导入

浏览器支持同时导入 `.md`、`.markdown` 和 `.txt` 文件。导入内容归属于当前登录成员，并识别以下 YAML frontmatter：

```markdown
---
title: 雨停之后
date: 2026-05-21T20:30:00+08:00
moods: quiet,tender
---

正文内容。
```

没有 `title` 时会使用第一个一级标题，再回退到文件名；没有日期时会尝试从文件名中的 `YYYY-MM-DD` 读取。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | 原生 HTML、CSS、JavaScript |
| Markdown | marked + DOMPurify |
| 后端 | FastAPI + Uvicorn |
| 数据库 | SQLite（WAL） |
| MCP | HTTP JSON-RPC 2.0 |

## 项目结构

```text
Ting_Diary/
├── server/
│   ├── main.py          # HTTP API、静态页面与 MCP 端点
│   ├── config.py        # 成员、token、数据库与心情配置
│   ├── database.py      # SQLite 数据访问
│   ├── auth.py          # Bearer token 身份验证
│   └── mcp_handler.py   # MCP 工具定义与调度
├── static/
│   ├── index.html       # 应用界面
│   ├── style.css        # 水雾与暮霭主题
│   └── app.js           # 浏览器交互与身份会话
├── tests/
├── PRODUCT.md
├── .env.example
└── requirements.txt
```

## 检查

```bash
python -m unittest discover
python -m compileall server tests
node --check static/app.js
```

## License

MIT
