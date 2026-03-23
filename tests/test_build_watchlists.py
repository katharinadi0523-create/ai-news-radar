import unittest

from scripts.build_watchlists import (
    WatchCategory,
    build_section,
    extract_appbuilder_updates_from_html,
    extract_aliyun_monthly_report_features,
    extract_aliyun_monthly_report_product_groups,
    extract_coze_notice_updates,
    extract_coze_release_updates,
    extract_embedded_json_link_candidates,
    extract_aliyun_monthly_report_candidates,
    extract_github_release_feature_points,
    extract_tencent_adp_monthly_updates,
    extract_tencent_adp_table_updates,
    match_item,
)


class BuildWatchlistsTests(unittest.TestCase):
    def test_extract_coze_notice_updates(self):
        payload = {
            "code": 0,
            "data": {
                "list": [
                    {
                        "id": 101,
                        "title": "【扣子】更新公告：部分模型下线通知",
                        "summary": "服务调整",
                        "content": "- 豆包1.6将于3月下线\\n- 请迁移到新模型",
                        "publish_time": "2026-02-26 10:00:00",
                        "tag": "更新公告",
                    }
                ]
            },
        }
        rows = extract_coze_notice_updates(payload, "https://code.coze.cn/api/playground_api/notice/get_list", feature_limit=10)
        self.assertEqual(len(rows), 1)
        self.assertIn("更新公告", rows[0]["title"])
        self.assertEqual(len(rows[0]["detail_points"]), 2)
        self.assertIn("请迁移到新模型", rows[0]["detail_points"][-1])

    def test_extract_tencent_adp_monthly_updates(self):
        html = """
        <h2>2026年01月</h2>
        <table>
          <tr><td>动态名称</td><td>动态描述</td><td>发布时间</td><td>相关文档</td></tr>
          <tr><td>新增资源看板</td><td>支持查看资源统计。</td><td>2026-01</td><td></td></tr>
          <tr><td>计费方案调整</td><td>升级套餐计费规则。</td><td>2026-01</td><td></td></tr>
        </table>
        <h2>2025年12月</h2>
        <table>
          <tr><td>动态名称</td><td>动态描述</td><td>发布时间</td><td>相关文档</td></tr>
          <tr><td>插件状态回显</td><td>新增失效提示。</td><td>2025-12</td><td></td></tr>
        </table>
        """
        rows = extract_tencent_adp_monthly_updates("https://cloud.tencent.com/document/product/1759/104191", html, feature_limit=10)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["title"], "腾讯云ADP更新动态【2026年01月】")
        self.assertEqual(len(rows[0]["detail_points"]), 2)
        self.assertIn("新增资源看板", rows[0]["detail_points"][0])

    def test_extract_coze_release_updates(self):
        md = """
        # 产品动态
        ## 2026 年 01 月 28 日
        ### 图像生成节点
        说明1
        ### 数据向量化
        说明2
        ## 2026 年 01 月 19 日
        ### MCP 优化
        """
        rows = extract_coze_release_updates(md, "https://docs.coze.cn/guides/release_note", feature_limit=10)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["title"], "扣子更新动态【2026 年 01 月 28 日】")
        self.assertIn("图像生成节点", rows[0]["features"])
        self.assertIn("#coze-update-", rows[0]["url"])

    def test_extract_appbuilder_updates_from_html(self):
        html = """
        <h1>更新动态</h1>
        <h2>2026年2月5日</h2>
        <p>【Agent开发】</p>
        <ul><li>深度研究Agent商业化发布</li></ul>
        <p>【工具广场】</p>
        <ul><li>百度AI搜索支持更多筛选条件</li></ul>
        <h2>2026年1月30日</h2>
        <p>【模型服务】</p>
        <p>新模型上线</p>
        """
        rows = extract_appbuilder_updates_from_html(html, "https://cloud.baidu.com/doc/qianfan/s/Mmh8l4qwj", feature_limit=10)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["title"], "AppBuilder 更新动态【2026年2月5日】")
        self.assertTrue(any("深度研究Agent商业化发布" in x for x in rows[0]["features"]))

    def test_extract_github_release_feature_points(self):
        body = """
        ## Feature Snapshots
        ### 🧩 Skill Editor + @tool
        Write reusable skills and call tools inline.
        ### 🧠 New Agent Runtime
        Ship multi-step agent flows with sandboxed execution.
        ## What's Changed
        - fix: typo
        """
        rows = extract_github_release_feature_points(body, limit=10)
        self.assertEqual(len(rows), 2)
        self.assertIn("Skill Editor + @tool", rows[0])
        self.assertIn("New Agent Runtime", rows[1])

    def test_extract_tencent_adp_table_updates(self):
        html = """
        <table>
          <tr><td>动态名称</td><td>动态描述</td><td>发布时间</td><td>相关文档</td></tr>
          <tr>
            <td>新增资源看板</td>
            <td>支持查看模型与插件资源统计。</td>
            <td>2026-01</td>
            <td><a href="/document/product/1759/100001">文档</a></td>
          </tr>
          <tr>
            <td>工作流能力升级</td>
            <td>支持更复杂的编排逻辑。</td>
            <td>2026-02</td>
            <td></td>
          </tr>
        </table>
        """
        rows = extract_tencent_adp_table_updates("https://cloud.tencent.com/document/product/1759/104191", html)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["title"], "新增资源看板")
        self.assertIn("资源统计", rows[0]["description"])
        self.assertEqual(rows[0]["url"], "https://cloud.tencent.com/document/product/1759/100001")
        self.assertEqual(rows[1]["url"], "https://cloud.tencent.com/document/product/1759/104191#adp-update-2")

    def test_extract_aliyun_monthly_report_features(self):
        html = r"""
        <script>
        GLOBAL_CONFIG.larkContent = '<h2>🍱本月核心升级速递</h2><p><strong>应用与知识库全面升级</strong>：支持音视频多模态检索。</p><h2>🎵 模型动态</h2><ul><li>本月Qwen3-Max模型再降价，最低直降6折。</li><li>新推出AI通用型节省计划。</li></ul><h2>👉产品动态</h2><ul><li>支持界面提交代码，支持模版一键创建。</li></ul>';
        </script>
        """
        feats = extract_aliyun_monthly_report_features(html, limit=10)
        self.assertGreaterEqual(len(feats), 3)
        self.assertTrue(any("Qwen3-Max模型再降价" in x for x in feats))
        self.assertTrue(any("支持界面提交代码" in x for x in feats))

    def test_extract_aliyun_monthly_report_product_groups(self):
        html = r"""
        <script>
        GLOBAL_CONFIG.larkContent = '<h2>👉产品动态</h2><h3>高代码应用和工作流全新升级</h3><ul><li>支持界面提交代码，支持模版一键创建；</li><li>FC、网关支持国内多region；</li></ul><h3>应用构建与多模态知识管理能力升级</h3><ul><li>Agent 2.0 焕新升级；</li><li>工作流知识节点全面升级；</li></ul>';
        </script>
        """
        groups = extract_aliyun_monthly_report_product_groups(html, limit=10)
        self.assertEqual(len(groups), 2)
        self.assertEqual(groups[0]["title"], "高代码应用和工作流全新升级")
        self.assertEqual(len(groups[0]["bullets"]), 2)
        self.assertIn("Agent 2.0 焕新升级", groups[1]["bullets"][0])

    def test_extract_embedded_json_link_candidates(self):
        html = r'''
        <script>
        window.__staticRouterHydrationData = JSON.parse("{\"loaderData\":{\"product-article\":{\"data\":{\"article\":{\"content\":{\"title\":\"关于\\u201c腾讯云大模型知识引擎\\u201d全新升级为\\u201c腾讯云智能体开发平台\\u201d的通知\"}}}},\"list\":[{\"url\":\"\/document\/product\/1759\/118517\",\"title\":\"关于\\u201c腾讯云大模型知识引擎\\u201d全新升级为\\u201c腾讯云智能体开发平台\\u201d的通知\",\"recentReleaseTime\":\"2025-07-30 17:30:32\"}]}}");
        </script>
        '''
        rows = extract_embedded_json_link_candidates(
            "https://cloud.tencent.com/document/product/1759/104191",
            html,
        )
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["url"], "https://cloud.tencent.com/document/product/1759/118517")
        self.assertIn("升级", rows[0]["title"])

    def test_extract_aliyun_monthly_report_candidates(self):
        html = """
        <html><body>
        <a class="feed-item-content-title" href="/article/1709938"><h3>阿里云百炼产品月报【2026年1月】</h3></a>
        <a class="feed-item-content-title" href="/article/1713223"><h3>OpenClaw 接入百炼</h3></a>
        <a class="slide-banner-content" href="https://developer.aliyun.com/article/1709000"><img alt="阿里云百炼产品月刊" /></a>
        </body></html>
        """
        rows = extract_aliyun_monthly_report_candidates("https://developer.aliyun.com/modelstudio/article", html)
        urls = {row["url"] for row in rows}
        self.assertIn("https://developer.aliyun.com/article/1709938", urls)
        self.assertIn("https://developer.aliyun.com/article/1709000", urls)
        self.assertEqual(len(rows), 2)

    def test_match_item_by_keyword(self):
        category = WatchCategory(
            category_id="palantir",
            name="Palantir",
            keywords=["palantir", "foundry"],
            exclude_keywords=[],
            domains=[],
            official_sources=[],
            official_only=False,
        )
        item = {
            "title": "Palantir Foundry updates",
            "url": "https://example.com/news",
        }
        score, terms = match_item(item, category)
        self.assertGreaterEqual(score, 2)
        self.assertIn("palantir", terms)

    def test_match_item_by_domain(self):
        category = WatchCategory(
            category_id="palantir",
            name="Palantir",
            keywords=["palantir"],
            exclude_keywords=[],
            domains=["palantir.com"],
            official_sources=[],
            official_only=False,
        )
        item = {
            "title": "Company blog post",
            "url": "https://www.palantir.com/platforms/foundry",
        }
        score, terms = match_item(item, category)
        self.assertGreaterEqual(score, 2)
        self.assertIn("domain:palantir.com", terms)

    def test_match_item_openclaw_by_claw_keyword(self):
        category = WatchCategory(
            category_id="openclaw",
            name="OpenClaw",
            keywords=["openclaw", "claw"],
            exclude_keywords=[],
            domains=[],
            official_sources=[],
            official_only=False,
        )
        item = {
            "title": "AI Claw desktop agent roundup",
            "url": "https://example.com/openclaw-news",
        }
        score, terms = match_item(item, category)
        self.assertGreaterEqual(score, 1)
        self.assertIn("claw", terms)

    def test_match_item_ai_for_science_combo(self):
        category = WatchCategory(
            category_id="ai-for-science",
            name="AI+科研",
            keywords=["ai for science"],
            exclude_keywords=[],
            domains=[],
            official_sources=[],
            official_only=False,
        )
        item = {
            "title": "AI model accelerates protein discovery research",
            "url": "https://example.com/science",
        }
        score, terms = match_item(item, category)
        self.assertGreaterEqual(score, 3)
        self.assertIn("combo:ai+science", terms)

    def test_build_section_dedup_by_id(self):
        category = WatchCategory(
            category_id="kg",
            name="知识图谱",
            keywords=["knowledge graph"],
            exclude_keywords=[],
            domains=[],
            official_sources=[],
            official_only=False,
        )
        items = [
            {
                "id": "same-id",
                "title": "Knowledge Graph in production",
                "url": "https://example.com/1",
                "published_at": "2026-02-20T01:00:00Z",
            },
            {
                "id": "same-id",
                "title": "Knowledge Graph in production",
                "url": "https://example.com/1",
                "published_at": "2026-02-20T02:00:00Z",
            },
        ]
        section = build_section(items, category, max_items=50)
        self.assertEqual(section["count"], 1)

    def test_build_section_dedup_by_title_url_across_sources(self):
        category = WatchCategory(
            category_id="skills",
            name="Skills",
            keywords=["skill"],
            exclude_keywords=[],
            domains=[],
            official_sources=[],
            official_only=False,
        )
        items = [
            {
                "id": "a",
                "site_id": "newsnow",
                "title": "Agent Skill 入门",
                "url": "https://example.com/post?utm_source=x",
                "published_at": "2026-02-20T01:00:00Z",
            },
            {
                "id": "b",
                "site_id": "buzzing",
                "title": "Agent Skill 入门",
                "url": "https://example.com/post",
                "published_at": "2026-02-20T02:00:00Z",
            },
        ]
        section = build_section(items, category, max_items=50)
        self.assertEqual(section["count"], 1)

    def test_exclude_keywords_filter(self):
        category = WatchCategory(
            category_id="palantir",
            name="Palantir",
            keywords=["palantir"],
            exclude_keywords=["股票", "stock"],
            domains=[],
            official_sources=[],
            official_only=False,
        )
        items = [
            {"id": "a", "title": "Palantir 获得新国防合同", "url": "https://example.com/a"},
            {"id": "b", "title": "Palantir 股票再创新高", "url": "https://example.com/b"},
        ]
        section = build_section(items, category, max_items=50)
        self.assertEqual(section["count"], 1)
        self.assertEqual(section["items"][0]["id"], "a")

    def test_ai_for_science_dedup_by_title_across_urls(self):
        category = WatchCategory(
            category_id="ai-for-science",
            name="AI+科研",
            keywords=["ai for science"],
            exclude_keywords=[],
            domains=[],
            official_sources=[],
            official_only=False,
        )
        items = [
            {
                "id": "x1",
                "title": "Verge (YC S15) Is Hiring a Director of Computational Biology and AI Scientists/Eng",
                "url": "https://news.ycombinator.com/item?id=1",
                "published_at": "2026-02-25T02:15:00Z",
            },
            {
                "id": "x2",
                "title": "Verge (YC S15) Is Hiring a Director of Computational Biology and AI Scientists/Eng",
                "url": "https://www.infoq.cn/article/abc",
                "published_at": "2026-02-25T01:00:00Z",
            },
        ]
        section = build_section(items, category, max_items=50)
        self.assertEqual(section["count"], 1)


if __name__ == "__main__":
    unittest.main()
