# AI News Radar

一个面向 AI/科技信息追踪的静态看板项目。  
它会抓取多源内容、做归档与去重、生成专题 JSON，并在前端展示为 4 个视图：

- `特别关注`
- `AI资讯`
- `AI HOTPOT🔥`
- `竞品更新追踪`

---

## 核心能力

- 聚合抓取：内置 10+ 公共信源，支持追加 OPML RSS 订阅。
- 24h 快照：生成 AI 相关条目 + 全量条目双视图数据。
- 持久归档：按 `archive_days` 保留历史并去重。
- 专题看板：从归档构建 `special-focus` 与 `competitor-monitor`。
- 官方渠道增强：watchlist 支持官方源解析（RSS/API/发布页/GitHub Releases 等）。
- WaytoAGI 近 7 日日志：失败时自动回退到上次成功缓存。
- 前端本地鉴权：`login.html` + localStorage session。
- 静态部署友好：前端直接读取 `data/*.json`。

---

## 数据来源（内置）

`scripts/update_news.py` 默认抓取以下来源：

- TechURLs
- Buzzing
- Info Flow (Iris)
- BestBlogs
- TopHub
- Zeli
- AI HubToday
- AIbase
- AI 今日热榜
- NewsNow

并可通过 `--rss-opml` 追加 OPML RSS（支持失败源跳过、替换、状态输出）。

---

## 项目结构

```text
.
├── assets/                     # 前端 JS/CSS/图标
├── config/watchlists.json      # 特别关注与竞品监控规则
├── data/                       # 生成的 JSON 数据
├── feeds/
│   ├── follow.example.opml     # OPML 示例
│   └── follow.opml             # 本地私有订阅（默认 gitignore）
├── scripts/
│   ├── update_news.py          # 主抓取与聚合
│   ├── build_watchlists.py     # watchlist 构建
│   └── serve_local.py          # 本地服务 + 后台刷新
├── tests/                      # 单元测试
├── index.html                  # 主页面
└── login.html                  # 登录页
```

---

## 环境要求

- Python 3.11+
- macOS / Linux / Windows（命令示例以 macOS/Linux 为主）

依赖见 `requirements.txt`：

- `requests`
- `beautifulsoup4`
- `feedparser`
- `python-dateutil`

---

## 快速开始

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
cp feeds/follow.example.opml feeds/follow.opml   # 可选
```

---

## 本地运行（推荐）

一条命令启动静态服务，并在后台刷新数据：

```bash
python scripts/serve_local.py --port 8080
```

打开：

- [http://127.0.0.1:8080/login.html](http://127.0.0.1:8080/login.html)

默认账号（前端本地存储）：

- 用户名：`AF_PM`
- 密码：`AgentNewsTracker`

说明：

- 进入 `index.html` 前会检查本地会话，未登录会自动跳转 `login.html`。
- `serve_local.py` 默认先开服务，再异步执行：
  - `update_news.py`
  - `build_watchlists.py`

如果只想预览已有静态文件（不刷新数据）：

```bash
python scripts/serve_local.py --port 8080 --skip-refresh
```

---

## 分步运行

### 1) 更新主数据

不带 OPML：

```bash
python scripts/update_news.py --output-dir data --window-hours 24
```

带 OPML：

```bash
python scripts/update_news.py --output-dir data --window-hours 24 --rss-opml feeds/follow.opml
```

### 2) 构建特别关注与竞品监控

```bash
python scripts/build_watchlists.py --env-file .env
```

---

## 常用命令

完整更新：

```bash
python scripts/update_news.py --output-dir data --window-hours 24 --rss-opml feeds/follow.opml && \
python scripts/build_watchlists.py --env-file .env
```

运行测试：

```bash
python -m unittest discover -s tests -p 'test_*.py'
```

---

## 脚本参数速查

### `scripts/update_news.py`

- `--output-dir`：输出目录（默认 `data`）
- `--window-hours`：24h 视图窗口小时数（默认 `24`）
- `--archive-days`：归档保留天数（默认 `45`）
- `--translate-max-new`：本次新增英译中标题上限（默认 `80`）
- `--rss-opml`：可选 OPML 路径
- `--rss-max-feeds`：限制 OPML 拉取 feed 数（`0`=不限制）

### `scripts/build_watchlists.py`

- `--input`：主数据输入（默认 `data/latest-24h.json`）
- `--archive`：归档输入（默认 `data/archive.json`）
- `--config`：watchlist 配置（默认 `config/watchlists.json`）
- `--output-special`：特别关注输出（默认 `data/special-focus.json`）
- `--output-competitor`：竞品监控输出（默认 `data/competitor-monitor.json`）
- `--special-window-days`：特别关注时间窗口（默认 `3`）
- `--competitor-window-days`：竞品监控时间窗口（默认 `7`）
- `--env-file`：环境变量文件（默认 `.env`）

### `scripts/serve_local.py`

- `--host`：绑定地址（默认 `127.0.0.1`）
- `--port`：端口（默认 `8080`）
- `--window-hours` / `--archive-days` / `--translate-max-new`：透传给 `update_news.py`
- `--rss-opml` / `--rss-max-feeds`：透传 OPML 参数
- `--env-file`：透传给 `build_watchlists.py`
- `--skip-watchlists`：跳过 watchlist 构建
- `--skip-refresh`：仅开静态服务，不刷新数据

---

## 输出文件说明

`scripts/update_news.py` 产出：

- `data/latest-24h.json`
- `data/archive.json`
- `data/source-status.json`
- `data/waytoagi-7d.json`
- `data/title-zh-cache.json`

`scripts/build_watchlists.py` 产出：

- `data/special-focus.json`
- `data/competitor-monitor.json`

---

## 配置说明

### 1) OPML 订阅

- 示例：`feeds/follow.example.opml`
- 本地私有文件：`feeds/follow.opml`（已在 `.gitignore`）

### 2) Watchlist 规则（`config/watchlists.json`）

主要结构：

- `special_focus`: 特别关注分组
- `competitor_monitor`: 竞品监控分组
- `defaults.max_items_per_bucket`: 每个分组最大条数

分类字段常用项：

- `id`, `name`
- `keywords`, `exclude_keywords`
- `domains`
- `official_only`
- `official_sources`（支持 `parser` / `method` / `payload` / `max_items` / `feature_items`）

### 3) `.env`（官方源鉴权，可选）

当前主要用于扣子编程公告接口：

- `COZE_NOTICE_COOKIE`
- `COZE_NOTICE_HEADERS_JSON`
- `COZE_NOTICE_X_CSRF_TOKEN`

未配置时不会阻塞主流程；对应官方源会记录到 `official_errors`。

### 4) AI HOTPOT（前端直连）

前端会请求：

- `POST https://api-public.lingowhale.com/api/feed/v2/feed/subscription`

可在浏览器 localStorage 覆盖鉴权配置：

- key: `lingowhale_feed_auth_v1`
- value 示例：

```json
{
  "headers": {
    "accessToken": "<ACCESS_TOKEN>",
    "authToken": "<AUTH_TOKEN>",
    "uId": "<U_ID>",
    "bId": "<B_ID>",
    "guestId": "<GUEST_ID>"
  },
  "channelIds": ["699fe88daffba3b7ded9a486"],
  "sortType": 2,
  "limit": 10,
  "filterUnread": false
}
```

---

## GitHub Actions 自动更新

工作流文件：`.github/workflows/update-news.yml`

- 触发：每 30 分钟 + 手动触发
- 步骤：
  - 安装 Python 依赖
  - 可选解码 `FOLLOW_OPML_B64` 到 `feeds/follow.opml`
  - 执行 `update_news.py`
  - 执行 `build_watchlists.py`
  - 提交并推送 `data/*.json`
  - 可选触发 Vercel 部署（依赖 `VERCEL_*` secrets）

---

## 常见问题

### WaytoAGI 抓取失败怎么办？

`update_news.py` 会优先回退 `data/waytoagi-7d.json` 的上次成功数据，并标记：

- `stale: true`
- `stale_reason`

### 为什么竞品或特别关注数量少？

- 先确认 `data/archive.json` 是否已更新
- 再检查 `config/watchlists.json` 的关键词/域名/排除词
- 如有官方源鉴权需求，确认 `.env` 是否配置

---

## License

仓库当前未声明 License。若需要开源分发，建议补充 `LICENSE` 文件。
