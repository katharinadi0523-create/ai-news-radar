import unittest
from datetime import datetime

from scripts.update_news import (
    SH_TZ,
    build_waytoagi_payload_on_failure,
    clean_update_title,
    decode_escaped_json,
    extract_waytoagi_recent_updates_from_block_map,
    infer_shanghai_year_for_month_day,
    is_usable_waytoagi_cache,
    parse_md_heading,
    parse_ym_heading,
)


class WaytoAgiUtilsTests(unittest.TestCase):
    def test_parse_ym_heading(self):
        self.assertEqual(parse_ym_heading("2026 年 2 月"), (2026, 2))

    def test_parse_md_heading(self):
        self.assertEqual(parse_md_heading("2 月 9 日"), (2, 9))

    def test_clean_update_title(self):
        self.assertEqual(clean_update_title("《 》  AI  更新  测试  "), "AI 更新 测试")

    def test_decode_escaped_json(self):
        raw = '{\\"id\\":\\"x\\",\\"type\\":\\"mention_doc\\",\\"data\\":{\\"title\\":\\"历史更新\\"}}'
        obj = decode_escaped_json(raw)
        self.assertEqual(obj["data"]["title"], "历史更新")

    def test_infer_shanghai_year_for_month_day(self):
        now = datetime(2026, 1, 2, 10, 0, tzinfo=SH_TZ)
        self.assertEqual(infer_shanghai_year_for_month_day(now, 12, 31), 2025)
        self.assertEqual(infer_shanghai_year_for_month_day(now, 1, 1), 2026)

    def test_extract_recent_updates_from_block_map(self):
        now = datetime(2026, 2, 20, 10, 0, tzinfo=SH_TZ)
        block_map = {
            "sec": {
                "data": {
                    "type": "heading1",
                    "parent_id": "root",
                    "text": {"initialAttributedTexts": {"text": {"0": "近 7 日更新日志"}}},
                }
            },
            "h1": {
                "data": {
                    "type": "heading3",
                    "parent_id": "root",
                    "text": {"initialAttributedTexts": {"text": {"0": "2 月 20 日"}}},
                }
            },
            "b1": {
                "data": {
                    "type": "bullet",
                    "parent_id": "h1",
                    "text": {"initialAttributedTexts": {"text": {"0": "《 》 OpenClaw 新教程"}}},
                }
            },
            "h2": {
                "data": {
                    "type": "heading3",
                    "parent_id": "other-root",
                    "text": {"initialAttributedTexts": {"text": {"0": "2 月 20 日"}}},
                }
            },
            "b2": {
                "data": {
                    "type": "bullet",
                    "parent_id": "h2",
                    "text": {"initialAttributedTexts": {"text": {"0": "不会被收集"}}},
                }
            },
        }
        out = extract_waytoagi_recent_updates_from_block_map(block_map, now, "https://example.com")
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["date"], "2026-02-20")
        self.assertEqual(out[0]["title"], "OpenClaw 新教程")

    def test_is_usable_waytoagi_cache(self):
        self.assertTrue(is_usable_waytoagi_cache({"has_error": False, "updates_7d": []}))
        self.assertFalse(is_usable_waytoagi_cache({"has_error": True, "updates_7d": []}))
        self.assertFalse(is_usable_waytoagi_cache({"has_error": False, "updates_7d": None}))

    def test_build_waytoagi_payload_on_failure_with_cache(self):
        now = datetime(2026, 3, 6, 10, 0, tzinfo=SH_TZ)
        cached = {
            "generated_at": "2026-03-05T10:00:00Z",
            "timezone": "Asia/Shanghai",
            "root_url": "https://example.com/root",
            "history_url": "https://example.com/history",
            "window_days": 7,
            "latest_date": "2026-03-05",
            "count_today": 1,
            "updates_today": [{"date": "2026-03-05", "title": "T", "detail": "D", "url": "U"}],
            "count_7d": 2,
            "updates_7d": [{"date": "2026-03-05", "title": "T", "detail": "D", "url": "U"}],
            "has_error": False,
            "error": None,
        }

        payload = build_waytoagi_payload_on_failure(
            now,
            "https://fallback-root.example",
            ValueError("Expecting value: line 1 column 1 (char 0)"),
            cached_payload=cached,
        )
        self.assertFalse(payload["has_error"])
        self.assertEqual(payload["count_7d"], 2)
        self.assertEqual(payload["warning"], "WaytoAGI 近7日更新抓取失败，已回退到上次成功数据")
        self.assertTrue(payload["stale"])
        self.assertIn("Expecting value", payload["stale_reason"])

    def test_build_waytoagi_payload_on_failure_without_cache(self):
        now = datetime(2026, 3, 6, 10, 0, tzinfo=SH_TZ)
        payload = build_waytoagi_payload_on_failure(
            now,
            "https://fallback-root.example",
            ValueError("bad json"),
            cached_payload=None,
        )
        self.assertTrue(payload["has_error"])
        self.assertEqual(payload["count_7d"], 0)
        self.assertEqual(payload["updates_7d"], [])
        self.assertEqual(payload["error"], "bad json")


if __name__ == "__main__":
    unittest.main()
