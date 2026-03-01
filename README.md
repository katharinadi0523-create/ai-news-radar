# AI News Radar

一个面向 AI/科技信息追踪的静态聚合看板项目：抓取多源新闻、输出结构化 JSON、并在前端展示 `AI资讯 / 特别关注 / 竞品更新监控` 三个视图。

## 功能概览

- 多源聚合：抓取站点源 + 可选 OPML RSS 订阅源
- 24 小时快照：输出 AI 强相关与全量数据视图
- WaytoAGI 更新日志：支持近 2 日 / 近 7 日展示
- 主题看板构建：从归档数据生成
  - `special-focus.json`（特别关注）
  - `competitor-monitor.json`（竞品更新监控）
- 失败源处理：支持 RSS 源替换、跳过和状态输出
- 静态部署友好：前端直接读取 `data/*.json`

## 项目结构

```text
.
├── assets/                     # 前端 JS/CSS/图标
├── config/watchlists.json      # 特别关注与竞品监控规则
├── data/                       # 生成的数据文件
├── feeds/
│   ├── follow.example.opml     # OPML 示例
│   └── follow.opml             # 你的私有订阅（建议不提交）
├── scripts/
│   ├── update_news.py          # 主抓取与聚合脚本
│   └── build_watchlists.py     # watchlist 数据构建脚本
├── tests/                      # 单元测试
└── index.html                  # 静态入口
```

## 环境要求

- Python 3.11+（推荐）
- macOS / Linux / Windows 均可（命令示例以 macOS/Linux 为主）

## 快速开始

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp feeds/follow.example.opml feeds/follow.opml
```

如果你没有私有 OPML，可以先不创建 `feeds/follow.opml`。

## 运行流程

### 1) 更新新闻主数据

无 OPML：

```bash
python scripts/update_news.py --output-dir data --window-hours 24
```

带 OPML：

```bash
python scripts/update_news.py --output-dir data --window-hours 24 --rss-opml feeds/follow.opml
```

### 2) 生成“特别关注 / 竞品监控”数据

```bash
python scripts/build_watchlists.py --env-file .env
```

### 3) 本地预览前端

推荐直接使用本地启动脚本。它会先启动静态服务，再在后台刷新新闻数据；页面打开后会继续轮询最新数据，抓取完成后会自动显示新的更新时间：

```bash
python scripts/serve_local.py --port 8080
```

打开 [http://localhost:8080](http://localhost:8080)

如果你只想单纯预览现有静态文件，不刷新数据：

```bash
python -m http.server 8080
```

## 常用命令

一键完整更新（主数据 + watchlists）：

```bash
python scripts/update_news.py --output-dir data --window-hours 24 --rss-opml feeds/follow.opml && \
python scripts/build_watchlists.py --env-file .env
```

运行测试：

```bash
python -m unittest discover -s tests -p 'test_*.py'
```

## 输出数据说明

`update_news.py` 产出：

- `data/latest-24h.json`
- `data/archive.json`
- `data/source-status.json`
- `data/waytoagi-7d.json`
- `data/title-zh-cache.json`

`build_watchlists.py` 产出：

- `data/special-focus.json`
- `data/competitor-monitor.json`

## 配置说明

### OPML 订阅

- 示例文件：`feeds/follow.example.opml`
- 建议将你自己的 `feeds/follow.opml` 加入 `.gitignore` 或仅在本地/CI 注入

### watchlist 规则

编辑 `config/watchlists.json`：

- `special_focus`：特别关注主题
- `competitor_monitor`：竞品追踪主题
- 每个主题可配置关键词、排除词、域名、官方信息源等

### `.env`（可选）

复制模板：

```bash
cp .env.example .env
```

当前主要用于“扣子编程公告接口”的登录态抓取：

- `COZE_NOTICE_COOKIE`
- `COZE_NOTICE_HEADERS_JSON`
- `COZE_NOTICE_X_CSRF_TOKEN`

未配置时脚本会按可用公开源继续构建，不会中断主流程。

## GitHub Actions 自动更新

仓库已包含工作流：`.github/workflows/update-news.yml`

- 触发：每 30 分钟 + 手动触发
- 行为：安装依赖，执行 `update_news.py`，提交 `data/*.json` 更新
- 可选 Secret：`FOLLOW_OPML_B64`（用于在 CI 解码生成 `feeds/follow.opml`）

如果你希望 CI 也自动更新 `special-focus.json` / `competitor-monitor.json`，可在工作流中追加 `build_watchlists.py` 步骤。

## 依赖

见 `requirements.txt`：

- `requests`
- `beautifulsoup4`
- `feedparser`
- `python-dateutil`

## 许可

当前仓库未声明 License。若要开源分发，建议补充 `LICENSE` 文件。
