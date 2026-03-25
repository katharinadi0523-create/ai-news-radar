import unittest
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

from scripts.update_news import (
    archive_payload_num_bytes,
    make_item_id,
    normalize_url,
    parse_date_any,
    parse_opml_subscriptions,
    parse_relative_time_zh,
    trim_archive_to_max_bytes,
)


class UtilsTests(unittest.TestCase):
    def test_normalize_url_removes_tracking(self):
        raw = "https://example.com/path?a=1&utm_source=x&fbclid=abc"
        self.assertEqual(normalize_url(raw), "https://example.com/path?a=1")

    def test_make_item_id_stable(self):
        a = make_item_id("site", "src", "Title", "https://a.com?p=1&utm_source=x")
        b = make_item_id("site", "src", "Title", "https://a.com?p=1")
        self.assertEqual(a, b)

    def test_parse_relative_time_zh_minutes(self):
        now = datetime(2026, 2, 19, 12, 0, tzinfo=timezone.utc)
        dt = parse_relative_time_zh("8分钟前", now)
        self.assertEqual(dt, datetime(2026, 2, 19, 11, 52, tzinfo=timezone.utc))

    def test_parse_date_any_english_rfc_not_misparsed_as_today(self):
        now = datetime(2026, 2, 21, 4, 30, tzinfo=timezone.utc)
        dt = parse_date_any("Tue, 07 Oct 2025 03:00:00 GMT", now)
        self.assertEqual(dt, datetime(2025, 10, 7, 3, 0, tzinfo=timezone.utc))

    def test_parse_opml_subscriptions(self):
        opml = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0"><body>
<outline text="A" title="A" xmlUrl="https://a.com/feed.xml" />
<outline text="A2" title="A2" xmlUrl="https://a.com/feed.xml" />
<outline text="B" xmlUrl="https://b.com/rss" />
</body></opml>"""
        with TemporaryDirectory() as td:
            p = Path(td) / "x.opml"
            p.write_text(opml, encoding="utf-8")
            feeds = parse_opml_subscriptions(p)
        self.assertEqual(len(feeds), 2)
        self.assertEqual(feeds[0]["title"], "A")
        self.assertEqual(feeds[1]["title"], "B")

    def test_trim_archive_to_max_bytes_keeps_newest_items(self):
        now = datetime(2026, 3, 25, 1, 0, tzinfo=timezone.utc)
        archive = {
            "new": {
                "id": "new",
                "title": "new" * 50,
                "last_seen_at": "2026-03-25T00:30:00Z",
            },
            "mid": {
                "id": "mid",
                "title": "mid" * 50,
                "last_seen_at": "2026-03-24T23:30:00Z",
            },
            "old": {
                "id": "old",
                "title": "old" * 50,
                "last_seen_at": "2026-03-24T22:30:00Z",
            },
        }

        single_item_bytes = archive_payload_num_bytes(now, [archive["new"]])
        trimmed, trimmed_count = trim_archive_to_max_bytes(archive, now, single_item_bytes + 32)

        self.assertEqual(trimmed_count, 2)
        self.assertEqual(list(trimmed.keys()), ["new"])

    def test_trim_archive_to_max_bytes_can_be_disabled(self):
        now = datetime(2026, 3, 25, 1, 0, tzinfo=timezone.utc)
        archive = {
            "a": {"id": "a", "last_seen_at": "2026-03-25T00:30:00Z"},
            "b": {"id": "b", "last_seen_at": "2026-03-24T23:30:00Z"},
        }

        trimmed, trimmed_count = trim_archive_to_max_bytes(archive, now, 0)

        self.assertEqual(trimmed_count, 0)
        self.assertEqual(trimmed, archive)


if __name__ == "__main__":
    unittest.main()
