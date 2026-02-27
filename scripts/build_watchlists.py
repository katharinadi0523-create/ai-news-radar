#!/usr/bin/env python3
"""Build sidecar watchlist datasets from latest-24h output."""

from __future__ import annotations

import argparse
import ast
import calendar
import hashlib
import json
import html
import os
import warnings
from urllib.parse import parse_qsl, urlencode
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
import re
from typing import Any
from urllib.parse import urljoin, urlparse, urlunparse

import feedparser
import requests
from bs4 import BeautifulSoup


UTC = timezone.utc


@dataclass
class WatchCategory:
    category_id: str
    name: str
    keywords: list[str]
    exclude_keywords: list[str]
    domains: list[str]
    official_sources: list[dict[str, str]]
    official_only: bool


def utc_now_iso() -> str:
    return datetime.now(tz=UTC).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_env_file(path: Path) -> None:
    if not path.exists() or not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = str(raw_line or "").strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        k = key.strip()
        v = value.strip()
        if not k:
            continue
        if v.startswith(("'", '"')) and v.endswith(("'", '"')) and len(v) >= 2:
            v = v[1:-1]
        os.environ.setdefault(k, v)


def parse_json_env_dict(env_name: str) -> dict[str, str]:
    raw = str(os.getenv(env_name) or "").strip()
    if not raw:
        return {}
    try:
        payload = json.loads(raw)
    except Exception:
        return {}
    if not isinstance(payload, dict):
        return {}
    out: dict[str, str] = {}
    for k, v in payload.items():
        ks = str(k or "").strip()
        vs = str(v or "").strip()
        if ks and vs:
            out[ks] = vs
    return out


def resolve_source_request_kwargs(source_meta: dict[str, Any]) -> dict[str, Any]:
    parser = str(source_meta.get("parser") or "").strip().lower()
    headers: dict[str, str] = {}
    if isinstance(source_meta.get("headers"), dict):
        for k, v in source_meta.get("headers", {}).items():
            ks = str(k or "").strip()
            vs = str(v or "").strip()
            if ks and vs:
                headers[ks] = vs

    headers_env = str(source_meta.get("headers_env") or "").strip()
    if headers_env:
        headers.update(parse_json_env_dict(headers_env))
    elif parser == "coze_notice_api":
        headers.update(parse_json_env_dict("COZE_NOTICE_HEADERS_JSON"))

    cookie_env = str(source_meta.get("cookie_env") or "").strip()
    cookie_value = str(os.getenv(cookie_env) or "").strip() if cookie_env else ""
    if not cookie_value and parser == "coze_notice_api":
        cookie_value = str(os.getenv("COZE_NOTICE_COOKIE") or "").strip()
    if cookie_value and "Cookie" not in headers:
        headers["Cookie"] = cookie_value

    csrf = str(os.getenv("COZE_NOTICE_X_CSRF_TOKEN") or "").strip()
    if parser == "coze_notice_api" and csrf and "x-csrf-token" not in {k.lower(): v for k, v in headers.items()}:
        headers["x-csrf-token"] = csrf

    kwargs: dict[str, Any] = {}
    if headers:
        kwargs["headers"] = headers
    return kwargs


def parse_iso(value: str | None) -> datetime | None:
    s = str(value or "").strip()
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt.astimezone(UTC)
    except Exception:
        return None


def event_time(item: dict[str, Any]) -> datetime | None:
    return parse_iso(str(item.get("published_at") or "")) or parse_iso(str(item.get("first_seen_at") or ""))


def host_of_url(raw_url: str) -> str:
    try:
        return urlparse(raw_url).netloc.lower()
    except Exception:
        return ""


def normalize_url(raw_url: str) -> str:
    try:
        parsed = urlparse(str(raw_url).strip())
        if not parsed.scheme:
            return str(raw_url).strip()
        query = []
        for k, v in parse_qsl(parsed.query, keep_blank_values=True):
            lk = k.lower()
            if lk.startswith("utm_"):
                continue
            if lk in {
                "ref",
                "spm",
                "fbclid",
                "gclid",
                "igshid",
                "mkt_tok",
                "mc_cid",
                "mc_eid",
                "_hsenc",
                "_hsmi",
            }:
                continue
            query.append((k, v))
        parsed = parsed._replace(
            scheme=parsed.scheme.lower(),
            netloc=parsed.netloc.lower(),
            fragment="",
            query=urlencode(query, doseq=True),
        )
        normalized = urlunparse(parsed)
        return normalized.rstrip("/")
    except Exception:
        return str(raw_url).strip()


def canonical_title(item: dict[str, Any]) -> str:
    return str(item.get("title_original") or item.get("title") or item.get("title_en") or item.get("title_zh") or "").strip().lower()


def canonical_title_key(item: dict[str, Any]) -> str:
    title = canonical_title(item)
    title = re.sub(r"<[^>]+>", " ", title)
    title = html.unescape(title)
    title = re.sub(r"\s+", " ", title).strip()
    return title


def keyword_hit(text_main: str, keyword: str) -> bool:
    kw = (keyword or "").strip().lower()
    if not kw:
        return False
    if re.search(r"[\u4e00-\u9fff]", kw):
        return kw in text_main
    pattern = re.compile(rf"(?<![a-z0-9]){re.escape(kw)}(?![a-z0-9])", re.IGNORECASE)
    return pattern.search(text_main) is not None


def normalize_categories(rows: list[dict[str, Any]]) -> list[WatchCategory]:
    out: list[WatchCategory] = []
    for row in rows:
        category_id = str(row.get("id") or "").strip()
        name = str(row.get("name") or category_id).strip()
        keywords = [str(x).strip().lower() for x in row.get("keywords", []) if str(x).strip()]
        exclude_keywords = [str(x).strip().lower() for x in row.get("exclude_keywords", []) if str(x).strip()]
        domains = [str(x).strip().lower() for x in row.get("domains", []) if str(x).strip()]
        official_sources: list[dict[str, str]] = []
        for src in row.get("official_sources", []):
            if isinstance(src, str):
                u = src.strip()
                if u:
                    official_sources.append({"url": u, "label": ""})
                continue
            if isinstance(src, dict):
                u = str(src.get("url") or "").strip()
                lb = str(src.get("label") or "").strip()
                if u:
                    item = dict(src)
                    item["url"] = u
                    item["label"] = lb
                    official_sources.append(item)
        official_only = bool(row.get("official_only", False))
        if category_id and keywords:
            out.append(
                WatchCategory(
                    category_id=category_id,
                    name=name,
                    keywords=keywords,
                    exclude_keywords=exclude_keywords,
                    domains=domains,
                    official_sources=official_sources,
                    official_only=official_only,
                )
            )
    return out


def create_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            )
        }
    )
    return s


def iso(dt: datetime | None) -> str | None:
    if not dt:
        return None
    return dt.astimezone(UTC).isoformat().replace("+00:00", "Z")


def datetime_from_struct_time(value: Any) -> datetime | None:
    if value is None:
        return None
    try:
        return datetime.fromtimestamp(calendar.timegm(value), tz=UTC)
    except Exception:
        return None


def parse_date_from_text(text: str) -> datetime | None:
    t = str(text or "")
    patterns = [
        r"(20\d{2})[-/\.](\d{1,2})[-/\.](\d{1,2})",
        r"(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日",
    ]
    for p in patterns:
        m = re.search(p, t)
        if not m:
            continue
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return datetime(y, mo, d, tzinfo=UTC)
        except Exception:
            continue
    month_name = r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*"
    m1 = re.search(rf"{month_name}\s+(\d{{1,2}}),\s*(20\d{{2}})", t, re.IGNORECASE)
    if m1:
        try:
            dt = datetime.strptime(f"{m1.group(1)} {m1.group(2)} {m1.group(3)}", "%b %d %Y")
            return dt.replace(tzinfo=UTC)
        except Exception:
            pass
    m2 = re.search(rf"(\d{{1,2}})\s+{month_name},?\s*(20\d{{2}})", t, re.IGNORECASE)
    if m2:
        try:
            dt = datetime.strptime(f"{m2.group(2)} {m2.group(1)} {m2.group(3)}", "%b %d %Y")
            return dt.replace(tzinfo=UTC)
        except Exception:
            pass
    return None


def parse_year_month_text(text: str) -> datetime | None:
    t = str(text or "")
    m = re.search(r"(20\d{2})[-/\.年]\s*(\d{1,2})", t)
    if not m:
        return None
    y, mo = int(m.group(1)), int(m.group(2))
    try:
        return datetime(y, mo, 1, tzinfo=UTC)
    except Exception:
        return None


def parse_date_from_html(html: str) -> datetime | None:
    dt = parse_date_from_text(html)
    if dt:
        return dt
    for pat in [
        r'content=["\'](20\d{2}-\d{1,2}-\d{1,2})["\']',
        r'"datePublished"\s*:\s*"([^"]+)"',
        r'"dateModified"\s*:\s*"([^"]+)"',
    ]:
        m = re.search(pat, html, re.IGNORECASE)
        if not m:
            continue
        d = parse_iso(m.group(1))
        if d:
            return d
        d2 = parse_date_from_text(m.group(1))
        if d2:
            return d2
    return None


def is_same_or_subdomain(host: str, parent: str) -> bool:
    h = (host or "").lower()
    p = (parent or "").lower()
    return bool(h and p and (h == p or h.endswith(f".{p}")))


def decode_escaped_text(s: str) -> str:
    raw = str(s or "")
    if not raw:
        return ""
    out = raw.replace("\\/", "/")
    if any(mark in out for mark in ("\\u", "\\x", "\\n", "\\t", '\\"')):
        try:
            out = bytes(out, "utf-8").decode("unicode_escape")
        except Exception:
            pass
    return html.unescape(out).strip()


def is_generic_announcement_title(title: str) -> bool:
    t = str(title or "").strip().lower()
    if not t:
        return True
    compact = re.sub(r"\s+", "", t)
    if any(x in compact for x in ["上一篇", "下一篇", "返回", "目录", "更多", "首页"]):
        return True
    if compact in {"产品公告", "公告"}:
        return True
    if any(x in compact for x in ["动态与公告", "发布渠道"]):
        return True
    if compact in {"升级公告", "腾讯云智能体开发平台", "tencentcloudadp"}:
        return True
    return False


def extract_embedded_json_link_candidates(source_url: str, html_text: str) -> list[dict[str, Any]]:
    source_host = host_of_url(source_url)
    source_parsed = urlparse(source_url)
    source_path = (source_parsed.path or "").rstrip("/")
    source_scope_path = source_path
    segs = [s for s in source_path.split("/") if s]
    if len(segs) >= 3 and segs[0] == "document" and segs[1] == "product":
        source_scope_path = "/" + "/".join(segs[:3])

    text = str(html_text or "").replace("\\/", "/")
    if '\\"' in text:
        text = text.replace('\\"', '"')
    out: dict[str, dict[str, Any]] = {}

    # Tencent docs embeds a hydration JSON string that includes structured title/url/date entries.
    hydration_match = re.search(
        r'window\.__staticRouterHydrationData\s*=\s*JSON\.parse\("(?P<data>.*)"\);',
        str(html_text or ""),
        re.S,
    )
    if hydration_match:
        try:
            raw = hydration_match.group("data")
            json_text = ast.literal_eval('"' + raw.replace("\\/", "/") + '"')
            payload = json.loads(json_text)

            def walk(node: Any) -> None:
                if isinstance(node, dict):
                    if "url" in node and "title" in node:
                        raw_url = str(node.get("url") or "").strip()
                        raw_title = str(node.get("title") or "").strip()
                        raw_dt = str(node.get("recentReleaseTime") or node.get("updatedAt") or "").strip()
                        url = urljoin(source_url, raw_url)
                        if raw_url and raw_title and url.startswith("http"):
                            if is_same_or_subdomain(host_of_url(url), source_host):
                                href_path = (urlparse(url).path or "").rstrip("/")
                                if source_scope_path in {"", "/"} or href_path == source_scope_path or href_path.startswith(f"{source_scope_path}/"):
                                    if not is_generic_announcement_title(raw_title):
                                        out[normalize_url(url)] = {
                                            "title": raw_title,
                                            "url": url,
                                            "published_at": parse_date_from_text(raw_dt),
                                        }
                    for v in node.values():
                        walk(v)
                elif isinstance(node, list):
                    for v in node:
                        walk(v)

            walk(payload.get("loaderData") if isinstance(payload, dict) else payload)
        except Exception:
            pass

    patterns = [
        r'"url"\s*:\s*"(?P<url>[^"]+)"[^{}]{0,480}"title"\s*:\s*"(?P<title>[^"]+)"(?:[^{}]{0,240}"recentReleaseTime"\s*:\s*"(?P<dt>[^"]+)")?',
        r'"title"\s*:\s*"(?P<title>[^"]+)"[^{}]{0,480}"url"\s*:\s*"(?P<url>[^"]+)"(?:[^{}]{0,240}"recentReleaseTime"\s*:\s*"(?P<dt>[^"]+)")?',
    ]
    for pat in patterns:
        for m in re.finditer(pat, text, re.IGNORECASE):
            raw_url = decode_escaped_text(m.group("url"))
            raw_title = decode_escaped_text(m.group("title"))
            raw_dt = decode_escaped_text(m.group("dt") or "")
            if not raw_url or not raw_title:
                continue
            url = urljoin(source_url, raw_url)
            if not url.startswith("http"):
                continue
            if not is_same_or_subdomain(host_of_url(url), source_host):
                continue
            href_path = (urlparse(url).path or "").rstrip("/")
            if source_scope_path and source_scope_path not in {"", "/"}:
                same_prefix = href_path == source_scope_path or href_path.startswith(f"{source_scope_path}/")
                if not same_prefix:
                    continue
            if is_generic_announcement_title(raw_title):
                continue
            dt = parse_date_from_text(raw_dt)
            key = normalize_url(url)
            prev = out.get(key)
            row = {"title": raw_title, "url": url, "published_at": dt}
            if prev is None:
                out[key] = row
            else:
                prev_title = str(prev.get("title") or "")
                if ("升级" in raw_title or "更新" in raw_title) and not ("升级" in prev_title or "更新" in prev_title):
                    out[key] = row
    return list(out.values())


def extract_tencent_adp_table_updates(source_url: str, html_text: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html_text, "html.parser")
    out: list[dict[str, Any]] = []
    row_index = 0
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue
        first_cols = [clean_feature_text(c.get_text(" ", strip=True)) for c in rows[0].find_all(["th", "td"])]
        first_line = " ".join(first_cols)
        if "动态名称" not in first_line or "动态描述" not in first_line:
            continue
        for tr in rows[1:]:
            cols = tr.find_all(["th", "td"])
            if len(cols) < 3:
                continue
            title = clean_feature_text(cols[0].get_text(" ", strip=True))
            description = clean_feature_text(cols[1].get_text(" ", strip=True))
            published_text = clean_feature_text(cols[2].get_text(" ", strip=True))
            if not title:
                continue
            published_at = parse_date_from_text(published_text) or parse_year_month_text(published_text)
            url = ""
            if len(cols) >= 4:
                a = cols[3].find("a", href=True)
                if a:
                    url = urljoin(source_url, str(a.get("href") or "").strip())
            row_index += 1
            if not url:
                url = f"{source_url}#adp-update-{row_index}"
            out.append(
                {
                    "title": title,
                    "description": description,
                    "url": url,
                    "published_at": published_at,
                }
            )
    return out


def extract_tencent_adp_monthly_updates(source_url: str, html_text: str, feature_limit: int = 20) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html_text, "html.parser")
    out: list[dict[str, Any]] = []
    month_pat = re.compile(r"(20\d{2})\s*年\s*(\d{1,2})\s*月")
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue
        head_cols = [clean_feature_text(c.get_text(" ", strip=True)) for c in rows[0].find_all(["th", "td"])]
        head_text = " ".join(head_cols)
        if "动态名称" not in head_text or "动态描述" not in head_text:
            continue
        heading = table.find_previous(["h2", "h3", "h4"])
        month_text = clean_feature_text(heading.get_text(" ", strip=True)) if heading else ""
        mm = month_pat.search(month_text)
        dt = None
        if mm:
            try:
                dt = datetime(int(mm.group(1)), int(mm.group(2)), 1, tzinfo=UTC)
            except Exception:
                dt = None
        points: list[str] = []
        for tr in rows[1:]:
            cols = tr.find_all(["th", "td"])
            if len(cols) < 2:
                continue
            name = clean_feature_text(cols[0].get_text(" ", strip=True))
            desc = clean_feature_text(cols[1].get_text(" ", strip=True))
            if not name:
                continue
            point = f"{name}：{desc}" if desc else name
            if point not in points:
                points.append(point)
        if feature_limit > 0:
            points = points[:feature_limit]
        if not points:
            continue
        month_label = month_text or (f"{dt.year}年{dt.month:02d}月" if dt else "")
        title = f"腾讯云ADP更新动态【{month_label}】" if month_label else "腾讯云ADP更新动态"
        month_slug = re.sub(r"[^\d]", "", month_label) or str(len(out) + 1)
        out.append(
            {
                "title": title,
                "url": f"{source_url}#adp-update-{month_slug}",
                "published_at": dt,
                "detail_points": points,
                "hover_description": f"{month_label} 官方更新" if month_label else "官方更新",
            }
        )
    out.sort(key=lambda x: x.get("published_at") or datetime.min.replace(tzinfo=UTC), reverse=True)
    return out


def coze_release_api_url(source_url: str) -> str:
    parsed = urlparse(source_url)
    host = parsed.netloc.lower()
    path = parsed.path or ""
    if host == "docs.coze.cn":
        if not path.startswith("/"):
            path = "/" + path
        return f"https://www.coze.cn/api/open/docs{path}"
    if host in {"www.coze.cn", "coze.cn"} and path.startswith("/open/docs/"):
        return f"https://www.coze.cn/api{path}"
    return source_url


def extract_coze_release_updates(markdown_text: str, source_url: str, feature_limit: int = 20) -> list[dict[str, Any]]:
    lines = [str(x or "").rstrip() for x in str(markdown_text or "").splitlines()]
    date_pat = re.compile(r"^\s*##\s*(20\d{2}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)\s*$")
    feature_pat = re.compile(r"^\s*###\s+(.+?)\s*$")
    current: dict[str, Any] | None = None
    out: list[dict[str, Any]] = []
    for ln in lines:
        dm = date_pat.match(ln)
        if dm:
            if current:
                out.append(current)
            date_text = clean_feature_text(dm.group(1))
            current = {
                "date_text": date_text,
                "published_at": parse_date_from_text(date_text),
                "features": [],
            }
            continue
        if current is None:
            continue
        fm = feature_pat.match(ln)
        if fm:
            f = clean_feature_text(fm.group(1))
            if f and f not in current["features"]:
                current["features"].append(f)
            continue
        stripped = clean_feature_text(ln)
        if stripped.startswith(("- ", "* ", "• ")):
            f = clean_feature_text(stripped[2:])
            if f and f not in current["features"]:
                current["features"].append(f)
    if current:
        out.append(current)
    for row in out:
        features = list(row.get("features") or [])
        if feature_limit > 0:
            features = features[:feature_limit]
        row["features"] = features
        dt = row.get("published_at")
        date_text = str(row.get("date_text") or "")
        date_key = re.sub(r"[^\d]", "-", date_text).strip("-") or "latest"
        row["title"] = f"扣子更新动态【{date_text}】" if date_text else "扣子更新动态"
        row["url"] = f"{source_url}#coze-update-{date_key}"
        row["hover_description"] = f"{date_text} 官方更新" if date_text else "官方更新"
    return out


def extract_appbuilder_updates_from_html(html_text: str, source_url: str, feature_limit: int = 20) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html_text, "html.parser")
    out: list[dict[str, Any]] = []
    date_headers = [h for h in soup.find_all("h2") if re.search(r"20\d{2}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日", h.get_text(" ", strip=True))]
    for idx, h2 in enumerate(date_headers, start=1):
        date_text = clean_feature_text(h2.get_text(" ", strip=True))
        dt = parse_date_from_text(date_text)
        features: list[str] = []
        current_tag = ""
        node = h2
        while True:
            node = node.find_next_sibling()
            if node is None:
                break
            if node.name == "h2":
                break
            raw = clean_feature_text(node.get_text(" ", strip=True))
            if not raw:
                continue
            if node.name == "p" and re.match(r"^【[^】]+】$", raw):
                current_tag = raw
                continue
            if node.name == "ul":
                for li in node.find_all("li"):
                    v = clean_feature_text(li.get_text(" ", strip=True))
                    if not v:
                        continue
                    point = f"{current_tag} {v}".strip() if current_tag else v
                    if point not in features:
                        features.append(point)
                continue
            if node.name == "p":
                point = f"{current_tag} {raw}".strip() if current_tag else raw
                if point not in features:
                    features.append(point)
        if feature_limit > 0:
            features = features[:feature_limit]
        out.append(
            {
                "date_text": date_text,
                "published_at": dt,
                "features": features,
                "title": f"AppBuilder 更新动态【{date_text}】" if date_text else "AppBuilder 更新动态",
                "url": f"{source_url}#appbuilder-update-{idx}",
                "hover_description": f"{date_text} 官方更新" if date_text else "官方更新",
            }
        )
    return out


def parse_datetime_any(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        ts = float(value)
        if ts > 10_000_000_000:  # milliseconds
            ts = ts / 1000.0
        try:
            return datetime.fromtimestamp(ts, tz=UTC)
        except Exception:
            return None
    s = str(value or "").strip()
    if not s:
        return None
    return parse_iso(s) or parse_date_from_text(s) or parse_year_month_text(s)


def split_notice_points(text: str, limit: int = 10) -> list[str]:
    raw = str(text or "")
    lines = [clean_feature_text(x) for x in re.split(r"[\n\r]+", raw)]
    points: list[str] = []
    for ln in lines:
        if not ln:
            continue
        v = re.sub(r"^[\-*•\d\.\)\s]+", "", ln).strip()
        if not v:
            continue
        if v not in points:
            points.append(v)
        if limit > 0 and len(points) >= limit:
            break
    return points[:limit] if limit > 0 else points


def extract_coze_notice_updates(payload: dict[str, Any], source_url: str, feature_limit: int = 12) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    data = payload.get("data")
    candidates: list[Any] = []
    if isinstance(data, dict):
        for key in ["list", "items", "records", "notices", "notice_list"]:
            v = data.get(key)
            if isinstance(v, list):
                candidates = v
                break
        if not candidates:
            for v in data.values():
                if isinstance(v, list) and v and isinstance(v[0], dict):
                    candidates = v
                    break
    elif isinstance(data, list):
        candidates = data
    for idx, item in enumerate(candidates, start=1):
        if not isinstance(item, dict):
            continue
        title = clean_feature_text(
            item.get("title")
            or item.get("notice_title")
            or item.get("name")
            or item.get("subject")
            or ""
        )
        summary = clean_feature_text(
            item.get("summary")
            or item.get("subtitle")
            or item.get("brief")
            or ""
        )
        content = clean_feature_text(
            item.get("content")
            or item.get("body")
            or item.get("detail")
            or item.get("description")
            or ""
        )
        tag_text = " ".join(
            [
                clean_feature_text(item.get("category") or ""),
                clean_feature_text(item.get("type") or ""),
                clean_feature_text(item.get("tag") or ""),
                clean_feature_text(item.get("biz_type") or ""),
            ]
        ).lower()
        text_blob = f"{title} {summary} {content} {tag_text}".lower()
        if "更新公告" not in text_blob and "notice" not in tag_text and "update" not in tag_text:
            continue
        if not title:
            continue
        dt = parse_datetime_any(
            item.get("publish_time")
            or item.get("published_at")
            or item.get("update_time")
            or item.get("updated_at")
            or item.get("create_time")
            or item.get("created_at")
        )
        points = split_notice_points("\n".join([summary, content]), limit=max(1, feature_limit))
        notice_id = clean_feature_text(item.get("id") or item.get("notice_id") or str(idx))
        rows.append(
            {
                "title": title,
                "url": f"{source_url}#notice-{notice_id}",
                "published_at": dt,
                "detail_points": points,
                "hover_description": "扣子编程更新公告",
            }
        )
    rows.sort(key=lambda x: x.get("published_at") or datetime.min.replace(tzinfo=UTC), reverse=True)
    return rows


def parse_github_repo_from_releases_url(source_url: str) -> tuple[str, str] | None:
    parsed = urlparse(source_url)
    if parsed.netloc.lower() not in {"github.com", "www.github.com"}:
        return None
    segs = [s for s in (parsed.path or "").split("/") if s]
    if len(segs) < 3:
        return None
    owner, repo = segs[0], segs[1]
    if segs[2].lower() != "releases":
        return None
    if not owner or not repo:
        return None
    return owner, repo


def extract_github_release_feature_points(body: str, limit: int = 12) -> list[str]:
    lines = [clean_feature_text(x) for x in str(body or "").splitlines()]
    bad_titles = {
        "feature snapshots",
        "what's changed",
        "whats changed",
        "what s changed",
        "full changelog",
        "highlights",
        "breaking changes",
        "bug fixes",
        "fixes",
        "docs",
        "documentation",
        "chore",
        "chores",
        "other",
        "contributors",
        "new contributors",
    }
    out: list[str] = []
    seen: set[str] = set()
    for line in lines:
        if not line:
            continue
        m = re.match(r"^\s{0,3}#{2,6}\s+(.+?)\s*$", line)
        if not m:
            continue
        title = clean_feature_text(m.group(1))
        if not title:
            continue
        title = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", title)
        title = title.replace("**", "").replace("__", "").replace("`", "")
        title = re.sub(r"^[:：\-\s]+", "", title).strip()
        if not title:
            continue
        compact = re.sub(r"[\s\W_]+", " ", title, flags=re.UNICODE).strip().lower()
        if compact in bad_titles:
            continue
        if any(
            k in compact
            for k in [
                "experience now",
                "try the experience now",
                "release notes",
                "upgrade guide",
                "other improvements",
                "security updates",
                "bug fixes",
                "fixes",
            ]
        ):
            continue
        if len(compact) <= 2:
            continue
        if compact not in seen:
            seen.add(compact)
            out.append(title)
        if limit > 0 and len(out) >= limit:
            break
    return out[:limit] if limit > 0 else out


def parse_title_from_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for sel in ["h1.article-title", "h1"]:
        node = soup.select_one(sel)
        if node:
            title = node.get_text(" ", strip=True)
            if title:
                return title
    if soup.title:
        title = soup.title.get_text(" ", strip=True)
        if title:
            return re.sub(r"-\s*阿里云开发者社区\s*$", "", title).strip()
    return ""


def extract_aliyun_lark_content(html_text: str) -> str:
    src = str(html_text or "")
    m = re.search(
        r"GLOBAL_CONFIG\.larkContent\s*=\s*(['\"])(?P<body>.*?)(?<!\\)\1\s*;",
        src,
        flags=re.S,
    )
    if not m:
        return ""
    raw = m.group("body")
    # Parse JS string literal robustly without corrupting already-decoded Unicode text.
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", SyntaxWarning)
            text = ast.literal_eval(f"'{raw}'")
    except Exception:
        text = raw
    text = str(text).replace("\\/", "/")
    # Repair JS surrogate pairs like \ud83d\ude80 into valid Unicode.
    if any(0xD800 <= ord(ch) <= 0xDFFF for ch in text):
        try:
            text = text.encode("utf-16", "surrogatepass").decode("utf-16", "ignore")
        except Exception:
            text = text.encode("utf-8", "ignore").decode("utf-8", "ignore")
    text = html.unescape(text)
    return text


def clean_feature_text(text: str) -> str:
    t = " ".join(str(text or "").replace("\u200b", "").replace("\ufeff", "").split())
    if not t:
        return ""
    t = re.sub(r"🔗\s*.*$", "", t).strip()
    t = re.sub(r"\s+", " ", t)
    return t.strip(" ：:;；，,。")


def extract_aliyun_monthly_report_features(detail_html: str, limit: int = 10) -> list[str]:
    lark_html = extract_aliyun_lark_content(detail_html)
    if not lark_html:
        return []
    soup = BeautifulSoup(lark_html, "html.parser")
    target_sections = ("核心升级", "模型动态", "产品动态")
    current = ""
    out: list[str] = []
    seen: set[str] = set()
    for node in soup.find_all(["h2", "li", "p"]):
        if node.name == "h2":
            current = clean_feature_text(node.get_text(" ", strip=True))
            continue
        if not any(k in current for k in target_sections):
            continue
        if node.name == "li":
            cand = clean_feature_text(node.get_text(" ", strip=True))
            if cand:
                key = cand.lower()
                if key not in seen:
                    seen.add(key)
                    out.append(cand)
        elif node.name == "p" and "核心升级" in current:
            strong = node.find("strong")
            if strong:
                cand = clean_feature_text(strong.get_text(" ", strip=True))
                if cand:
                    key = cand.lower()
                    if key not in seen:
                        seen.add(key)
                        out.append(cand)
        if limit > 0 and len(out) >= limit:
            break
    return out[:limit] if limit > 0 else out


def extract_aliyun_monthly_report_product_groups(detail_html: str, limit: int = 20) -> list[dict[str, Any]]:
    lark_html = extract_aliyun_lark_content(detail_html)
    if not lark_html:
        return []
    soup = BeautifulSoup(lark_html, "html.parser")
    in_product_section = False
    groups: list[dict[str, Any]] = []
    current_title = ""

    def ensure_group(title: str) -> dict[str, Any]:
        t = clean_feature_text(title) or "产品动态要点"
        for g in groups:
            if g.get("title") == t:
                return g
        g = {"title": t, "bullets": []}
        groups.append(g)
        return g

    for node in soup.find_all(["h2", "h3", "h4", "p", "li", "ul", "ol"]):
        if node.name == "h2":
            sec = clean_feature_text(node.get_text(" ", strip=True))
            if "产品动态" in sec:
                in_product_section = True
                current_title = ""
                continue
            if in_product_section:
                break
            continue
        if not in_product_section:
            continue
        if node.name in {"h3", "h4"}:
            current_title = clean_feature_text(node.get_text(" ", strip=True))
            continue
        if node.name == "p":
            strong = node.find("strong")
            p_text = clean_feature_text((strong.get_text(" ", strip=True) if strong else node.get_text(" ", strip=True)))
            if p_text and len(p_text) <= 48 and not re.search(r"[。；;:：]", p_text):
                current_title = p_text
            continue
        if node.name == "li":
            bullet = clean_feature_text(node.get_text(" ", strip=True))
            if not bullet:
                continue
            group = ensure_group(current_title or "产品动态要点")
            bullets = list(group.get("bullets") or [])
            if bullet not in bullets:
                bullets.append(bullet)
                group["bullets"] = bullets
    out: list[dict[str, Any]] = []
    for g in groups:
        bullets = list(g.get("bullets") or [])
        if not bullets:
            continue
        if limit > 0:
            bullets = bullets[:limit]
        out.append({"title": str(g.get("title") or "").strip(), "bullets": bullets})
    return out


def extract_aliyun_monthly_report_candidates(source_url: str, html: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    by_url: dict[str, dict[str, Any]] = {}
    monthly_title_pat = re.compile(r"(百炼产品月报|阿里云百炼产品月报|百炼产品月刊|产品月报)")
    month_text_pat = re.compile(r"(20\d{2}\s*年\s*\d{1,2}\s*月)")

    def title_quality(title_text: str) -> tuple[int, int]:
        t = title_text or ""
        score = 0
        if "月报" in t:
            score += 3
        if "月刊" in t:
            score += 1
        if month_text_pat.search(t):
            score += 2
        return (score, len(t))

    for a in soup.select("a.feed-item-content-title[href], a.slide-banner-content[href]"):
        href = urljoin(source_url, str(a.get("href") or "").strip())
        if not href.startswith("http"):
            continue
        title = ""
        h3 = a.find("h3")
        if h3:
            title = h3.get_text(" ", strip=True)
        if not title:
            title = a.get_text(" ", strip=True)
        if not title:
            title = str(a.get("title") or "").strip()
        if not title:
            alt = ""
            img = a.find("img")
            if img:
                alt = str(img.get("alt") or "").strip()
            title = alt
        title = " ".join(title.split())
        if not title:
            continue
        if monthly_title_pat.search(title) is None and month_text_pat.search(title) is None:
            continue
        row = {"title": title, "url": href}
        old = by_url.get(href)
        if old is None or title_quality(title) > title_quality(str(old.get("title") or "")):
            by_url[href] = row
    return list(by_url.values())


def fetch_official_items(
    session: requests.Session,
    category: WatchCategory,
    window_days: int,
) -> tuple[list[dict[str, Any]], list[str]]:
    now = datetime.now(tz=UTC)
    keep_after = now - timedelta(days=max(1, int(window_days)))
    items: list[dict[str, Any]] = []
    errors: list[str] = []
    detail_date_cache: dict[str, datetime | None] = {}
    detail_title_cache: dict[str, str] = {}

    for source_meta in category.official_sources:
        source_url = str(source_meta.get("url") or "").strip()
        source_label = str(source_meta.get("label") or "").strip()
        source_parser = str(source_meta.get("parser") or "").strip().lower()
        source_max_items = int(source_meta.get("max_items") or 0)
        label_prefix = f"【{source_label}】 " if source_label else ""
        source_method = str(source_meta.get("method") or "GET").strip().upper()
        source_payload = source_meta.get("payload")
        request_kwargs = resolve_source_request_kwargs(source_meta)
        try:
            if source_method == "POST":
                if isinstance(source_payload, dict):
                    resp = session.post(source_url, json=source_payload, timeout=20, **request_kwargs)
                else:
                    resp = session.post(source_url, timeout=20, **request_kwargs)
            else:
                resp = session.get(source_url, timeout=20, **request_kwargs)
            resp.raise_for_status()
        except Exception as exc:
            errors.append(f"{source_url}: {exc}")
            continue

        source_parsed = urlparse(source_url)
        source_host = host_of_url(source_url)
        source_page_date = parse_date_from_html(resp.text)
        if source_parser in {"rss", "atom", "feed"}:
            try:
                parsed = feedparser.parse(resp.content)
            except Exception as exc:
                errors.append(f"{source_url}: rss parse failed: {exc}")
                continue

            rows: list[dict[str, Any]] = []
            for entry in list(getattr(parsed, "entries", []) or []):
                title = clean_feature_text(str(entry.get("title") or ""))
                url = str(entry.get("link") or "").strip()
                summary = clean_feature_text(str(entry.get("summary") or entry.get("description") or ""))
                dt = (
                    datetime_from_struct_time(entry.get("published_parsed"))
                    or datetime_from_struct_time(entry.get("updated_parsed"))
                    or parse_date_from_text(
                        f"{entry.get('published', '')} {entry.get('updated', '')} {entry.get('created', '')}"
                    )
                )
                if not title or not url:
                    continue
                rows.append({"title": title, "url": url, "published_at": dt, "hover_description": summary})

            rows_recent: list[dict[str, Any]] = []
            rows_old: list[dict[str, Any]] = []
            rows_no_date: list[dict[str, Any]] = []
            for row in rows:
                dt = row.get("published_at")
                if dt is None:
                    rows_no_date.append(row)
                elif dt >= keep_after:
                    rows_recent.append(row)
                else:
                    rows_old.append(row)
            rows_recent.sort(key=lambda x: x.get("published_at") or datetime.min.replace(tzinfo=UTC), reverse=True)
            rows_old.sort(key=lambda x: x.get("published_at") or datetime.min.replace(tzinfo=UTC), reverse=True)
            selected_rows = rows_recent or rows_old[:8] or rows_no_date[:8]
            keep_n = source_max_items if source_max_items > 0 else 10
            for row in selected_rows[:keep_n]:
                title = str(row.get("title") or "").strip()
                url = str(row.get("url") or source_url).strip()
                dt = row.get("published_at") or source_page_date
                items.append(
                    {
                        "id": hashlib.sha1(f"{category.category_id}|{url}|{title}".encode("utf-8")).hexdigest(),
                        "site_id": "official",
                        "site_name": "Official",
                        "source": f"官方渠道: {label_prefix}{source_host}",
                        "title": title,
                        "url": url,
                        "published_at": iso(dt),
                        "first_seen_at": iso(now),
                        "watch_score": 90,
                        "watch_matched_terms": ["official-source", "rss-feed"],
                        "hover_description": str(row.get("hover_description") or ""),
                    }
                )
            continue
        soup = BeautifulSoup(resp.text, "html.parser")
        if source_parser == "coze_notice_api":
            try:
                payload = resp.json()
            except Exception:
                payload = {}
            if isinstance(payload, dict) and int(payload.get("code") or 0) != 0:
                errors.append(f"{source_url}: {payload.get('msg') or 'api error'}")
                continue
            rows = extract_coze_notice_updates(
                payload if isinstance(payload, dict) else {},
                source_url=source_url,
                feature_limit=int(source_meta.get("feature_items") or 12),
            )
            keep_n = source_max_items if source_max_items > 0 else 20
            for row in rows[:keep_n]:
                title = str(row.get("title") or "").strip()
                if not title:
                    continue
                dt = row.get("published_at") or source_page_date
                detail_points = list(row.get("detail_points") or [])
                items.append(
                    {
                        "id": hashlib.sha1(f"{category.category_id}|{row.get('url')}|{title}".encode("utf-8")).hexdigest(),
                        "site_id": "official",
                        "site_name": "Official",
                        "source": f"官方渠道: {label_prefix}{source_host}",
                        "title": title,
                        "url": str(row.get("url") or source_url),
                        "published_at": iso(dt),
                        "first_seen_at": iso(now),
                        "watch_score": 90,
                        "watch_matched_terms": ["official-source", "notice-api"],
                        "detail_points": detail_points,
                        "hover_description": str(row.get("hover_description") or ""),
                        "auto_expand_details": True if detail_points else False,
                    }
                )
            continue
        if source_parser == "coze_release_note_markdown":
            api_url = coze_release_api_url(source_url)
            try:
                api_resp = session.get(api_url, timeout=20)
                api_resp.raise_for_status()
                markdown_text = str(api_resp.text or "")
            except Exception as exc:
                errors.append(f"{api_url}: {exc}")
                continue
            feature_limit = int(source_meta.get("feature_items") or 20)
            rows = extract_coze_release_updates(markdown_text, source_url=source_url, feature_limit=max(1, feature_limit))
            rows.sort(key=lambda x: x.get("published_at") or datetime.min.replace(tzinfo=UTC), reverse=True)
            keep_n = source_max_items if source_max_items > 0 else 24
            for row in rows[:keep_n]:
                title = str(row.get("title") or "").strip()
                url = str(row.get("url") or source_url).strip()
                dt = row.get("published_at") or source_page_date
                if not title:
                    continue
                items.append(
                    {
                        "id": hashlib.sha1(f"{category.category_id}|{url}|{title}".encode("utf-8")).hexdigest(),
                        "site_id": "official",
                        "site_name": "Official",
                        "source": f"官方渠道: {label_prefix}{source_host}",
                        "title": title,
                        "url": url,
                        "published_at": iso(dt),
                        "first_seen_at": iso(now),
                        "watch_score": 90,
                        "watch_matched_terms": ["official-source", "release-note"],
                        "detail_points": list(row.get("features") or []),
                        "hover_description": str(row.get("hover_description") or ""),
                        "auto_expand_details": True if list(row.get("features") or []) else False,
                    }
                )
            continue
        if source_parser == "baidu_qianfan_update_page":
            feature_limit = int(source_meta.get("feature_items") or 20)
            rows = extract_appbuilder_updates_from_html(resp.text, source_url=source_url, feature_limit=max(1, feature_limit))
            rows.sort(key=lambda x: x.get("published_at") or datetime.min.replace(tzinfo=UTC), reverse=True)
            keep_n = source_max_items if source_max_items > 0 else 24
            for row in rows[:keep_n]:
                title = str(row.get("title") or "").strip()
                url = str(row.get("url") or source_url).strip()
                dt = row.get("published_at") or source_page_date
                if not title:
                    continue
                items.append(
                    {
                        "id": hashlib.sha1(f"{category.category_id}|{url}|{title}".encode("utf-8")).hexdigest(),
                        "site_id": "official",
                        "site_name": "Official",
                        "source": f"官方渠道: {label_prefix}{source_host}",
                        "title": title,
                        "url": url,
                        "published_at": iso(dt),
                        "first_seen_at": iso(now),
                        "watch_score": 90,
                        "watch_matched_terms": ["official-source", "release-note"],
                        "detail_points": list(row.get("features") or []),
                        "hover_description": str(row.get("hover_description") or ""),
                        "auto_expand_details": True if list(row.get("features") or []) else False,
                    }
                )
            continue
        if source_parser == "github_releases_features":
            repo = parse_github_repo_from_releases_url(source_url)
            if not repo:
                errors.append(f"{source_url}: invalid github releases url")
                continue
            owner, repo_name = repo
            api_url = f"https://api.github.com/repos/{owner}/{repo_name}/releases"
            try:
                gh_resp = session.get(api_url, timeout=20, headers={"Accept": "application/vnd.github+json"})
                gh_resp.raise_for_status()
                release_rows = gh_resp.json()
            except Exception as exc:
                errors.append(f"{api_url}: {exc}")
                continue
            if not isinstance(release_rows, list):
                continue
            parsed_rows: list[dict[str, Any]] = []
            feature_limit = int(source_meta.get("feature_items") or 12)
            for row in release_rows:
                if not isinstance(row, dict):
                    continue
                if bool(row.get("draft")):
                    continue
                tag = clean_feature_text(str(row.get("tag_name") or ""))
                name = clean_feature_text(str(row.get("name") or ""))
                title = tag or name
                if not title:
                    continue
                published_raw = str(row.get("published_at") or row.get("created_at") or "")
                dt = parse_iso(published_raw) or parse_date_from_text(published_raw)
                body_md = str(row.get("body") or "")
                points = extract_github_release_feature_points(body_md, limit=max(1, feature_limit))
                parsed_rows.append(
                    {
                        "title": title,
                        "url": str(row.get("html_url") or source_url),
                        "published_at": dt,
                        "detail_points": points,
                    }
                )
            rows_recent: list[dict[str, Any]] = []
            rows_old: list[dict[str, Any]] = []
            rows_no_date: list[dict[str, Any]] = []
            for row in parsed_rows:
                dt = row.get("published_at")
                if dt is None:
                    rows_no_date.append(row)
                elif dt >= keep_after:
                    rows_recent.append(row)
                else:
                    rows_old.append(row)
            rows_recent.sort(key=lambda x: x.get("published_at") or datetime.min.replace(tzinfo=UTC), reverse=True)
            rows_old.sort(key=lambda x: x.get("published_at") or datetime.min.replace(tzinfo=UTC), reverse=True)
            selected_rows = rows_recent
            if not selected_rows:
                selected_rows = rows_old[:5]
            if not selected_rows:
                selected_rows = rows_no_date[:5]
            keep_n = source_max_items if source_max_items > 0 else 10
            for row in selected_rows[:keep_n]:
                title = str(row.get("title") or "").strip()
                url = str(row.get("url") or source_url).strip()
                dt = row.get("published_at") or source_page_date
                points = list(row.get("detail_points") or [])
                items.append(
                    {
                        "id": hashlib.sha1(f"{category.category_id}|{url}|{title}".encode("utf-8")).hexdigest(),
                        "site_id": "official",
                        "site_name": "Official",
                        "source": f"官方渠道: {label_prefix}{source_host}",
                        "title": title,
                        "url": url,
                        "published_at": iso(dt),
                        "first_seen_at": iso(now),
                        "watch_score": 90,
                        "watch_matched_terms": ["official-source", "github-release"],
                        "detail_points": points,
                        "auto_expand_details": True if points else False,
                    }
                )
            continue
        if source_parser == "tencent_adp_table":
            update_rows = extract_tencent_adp_monthly_updates(
                source_url=source_url,
                html_text=resp.text,
                feature_limit=int(source_meta.get("feature_items") or 20),
            )
            rows_recent: list[dict[str, Any]] = []
            rows_old: list[dict[str, Any]] = []
            rows_no_date: list[dict[str, Any]] = []
            for row in update_rows:
                title = str(row.get("title") or "").strip()
                if not title:
                    continue
                dt = row.get("published_at")
                if dt is None:
                    rows_no_date.append(row)
                elif dt >= keep_after:
                    rows_recent.append(row)
                else:
                    rows_old.append(row)

            selected_rows = rows_recent
            if not selected_rows:
                selected_rows = rows_old[:8]
            if not selected_rows:
                selected_rows = rows_no_date[:8]
            if source_max_items > 0:
                selected_rows = selected_rows[:source_max_items]

            for row in selected_rows:
                url = str(row.get("url") or "").strip() or source_url
                desc = str(row.get("description") or "").strip()
                detail_points = list(row.get("detail_points") or [])
                dt = row.get("published_at") or source_page_date
                title = str(row.get("title") or "").strip()
                items.append(
                    {
                        "id": hashlib.sha1(f"{category.category_id}|{url}|{title}".encode("utf-8")).hexdigest(),
                        "site_id": "official",
                        "site_name": "Official",
                        "source": f"官方渠道: {label_prefix}{source_host}",
                        "title": title,
                        "url": url,
                        "published_at": iso(dt),
                        "first_seen_at": iso(now),
                        "watch_score": 90,
                        "watch_matched_terms": ["official-source", "table-update"],
                        "hover_description": desc or str(row.get("hover_description") or ""),
                        "detail_points": detail_points,
                        "auto_expand_details": True if detail_points else False,
                    }
                )
            continue
        if source_parser == "aliyun_bailian_monthly_report":
            monthly_candidates = extract_aliyun_monthly_report_candidates(source_url=source_url, html=resp.text)
            monthly_rows: list[dict[str, Any]] = []
            detail_html_cache: dict[str, str] = {}
            for row in monthly_candidates:
                url = str(row.get("url") or "").strip()
                if not url:
                    continue
                dt = None
                if url not in detail_date_cache:
                    try:
                        detail_resp = session.get(url, timeout=20)
                        if detail_resp.ok:
                            detail_date_cache[url] = parse_date_from_html(detail_resp.text)
                            detail_title_cache[url] = parse_title_from_html(detail_resp.text)
                            detail_html_cache[url] = detail_resp.text
                        else:
                            detail_date_cache[url] = None
                            detail_title_cache[url] = ""
                            detail_html_cache[url] = ""
                    except Exception:
                        detail_date_cache[url] = None
                        detail_title_cache[url] = ""
                        detail_html_cache[url] = ""
                dt = detail_date_cache.get(url) or source_page_date
                detail_title = str(detail_title_cache.get(url) or "").strip()
                if detail_title:
                    row["title"] = detail_title
                monthly_rows.append(
                    {
                        "title": str(row.get("title") or "").strip(),
                        "url": url,
                        "published_at": dt,
                    }
                )
            monthly_rows.sort(
                key=lambda x: (x.get("published_at") or datetime.min.replace(tzinfo=UTC), x.get("url") or ""),
                reverse=True,
            )
            keep_n = source_max_items if source_max_items > 0 else 1
            for row in monthly_rows[:keep_n]:
                dt = row.get("published_at")
                url = str(row.get("url") or "").strip()
                report_title = str(row.get("title") or "").strip() or f"{category.name} 官方更新"
                detail_html = detail_html_cache.get(url) or ""
                feature_limit = int(source_meta.get("feature_items") or 10)
                groups = extract_aliyun_monthly_report_product_groups(detail_html, limit=max(1, feature_limit))
                features = extract_aliyun_monthly_report_features(detail_html, limit=max(1, feature_limit))
                if groups:
                    flat_from_groups: list[str] = []
                    for g in groups:
                        title = clean_feature_text(g.get("title") or "")
                        for b in list(g.get("bullets") or []):
                            flat_from_groups.append(f"{title}：{b}" if title else b)
                    if flat_from_groups:
                        features = flat_from_groups
                items.append(
                    {
                        "id": hashlib.sha1(f"{category.category_id}|{url}|{report_title}".encode("utf-8")).hexdigest(),
                        "site_id": "official",
                        "site_name": "Official",
                        "source": f"官方渠道: {label_prefix}{source_host}",
                        "title": report_title,
                        "url": url,
                        "published_at": iso(dt),
                        "first_seen_at": iso(now),
                        "watch_score": 90,
                        "watch_matched_terms": ["official-source", "monthly-feature"] if features else ["official-source"],
                        "detail_points": features,
                        "detail_groups": groups,
                        "auto_expand_details": True if features else False,
                    }
                )
            continue
        source_path = (source_parsed.path or "").rstrip("/")
        source_scope_path = source_path
        segs = [s for s in source_path.split("/") if s]
        if len(segs) >= 3 and segs[0] == "document" and segs[1] == "product":
            source_scope_path = "/" + "/".join(segs[:3])
        source_title = (
            (soup.title.get_text(strip=True) if soup.title else "")
            or category.name
        )

        candidates: dict[str, dict[str, Any]] = {}
        embedded_rows = extract_embedded_json_link_candidates(source_url=source_url, html_text=resp.text)
        for row in embedded_rows:
            href = str(row.get("url") or "").strip()
            title = str(row.get("title") or "").strip()
            if not href or not title:
                continue
            candidates[href] = {
                "title": title,
                "url": href,
                "published_at": row.get("published_at"),
            }

        for a in soup.select("a[href]"):
            href = urljoin(source_url, a.get("href") or "")
            text = " ".join(a.stripped_strings)
            parent_text = ""
            try:
                parent_text = " ".join(a.parent.stripped_strings)
            except Exception:
                parent_text = ""
            if not href.startswith("http"):
                continue
            if not is_same_or_subdomain(host_of_url(href), source_host):
                continue
            href_path = (urlparse(href).path or "").rstrip("/")
            if source_scope_path and source_scope_path not in {"", "/"}:
                same_prefix = href_path == source_scope_path or href_path.startswith(f"{source_scope_path}/")
                if not same_prefix:
                    continue
            text_l = text.lower()
            hit_kw = any(keyword_hit(text_l, kw) for kw in category.keywords)
            hit_release = re.search(r"(更新|发布|版本|公告|release|changelog|note)", text_l, re.IGNORECASE) is not None
            if not (hit_kw or hit_release):
                continue
            dt = parse_date_from_text(f"{text} {parent_text} {href}")
            candidates[href] = {
                "title": text or source_title,
                "url": href,
                "published_at": dt,
            }

        # Expand category/aggregate announcement pages into concrete per-announcement rows.
        generic_links = [
            str(v.get("url") or "")
            for v in candidates.values()
            if is_generic_announcement_title(str(v.get("title") or ""))
        ][:3]
        for glink in generic_links:
            try:
                gresp = session.get(glink, timeout=20)
                if not gresp.ok:
                    continue
            except Exception:
                continue
            for row in extract_embedded_json_link_candidates(source_url=glink, html_text=gresp.text):
                href = str(row.get("url") or "").strip()
                title = str(row.get("title") or "").strip()
                if not href or not title or is_generic_announcement_title(title):
                    continue
                candidates[href] = {
                    "title": title,
                    "url": href,
                    "published_at": row.get("published_at"),
                }

        if not candidates:
            continue

        rows_with_date_recent: list[dict[str, Any]] = []
        rows_with_date_old: list[dict[str, Any]] = []
        rows_without_date: list[dict[str, Any]] = []
        for row in candidates.values():
            if is_generic_announcement_title(str(row.get("title") or "")):
                continue
            dt = row.get("published_at")
            if dt is None:
                rows_without_date.append(row)
            elif dt >= keep_after:
                rows_with_date_recent.append(row)
            else:
                rows_with_date_old.append(row)

        rows_with_date_recent.sort(key=lambda x: x.get("published_at") or datetime.min.replace(tzinfo=UTC), reverse=True)
        rows_with_date_old.sort(key=lambda x: x.get("published_at") or datetime.min.replace(tzinfo=UTC), reverse=True)
        selected_rows = rows_with_date_recent
        if not selected_rows:
            selected_rows = rows_with_date_old[:3]
        if not selected_rows:
            selected_rows = rows_without_date[:5]
        if not selected_rows:
            continue
        for row in selected_rows:
            dt = row.get("published_at")
            url = str(row.get("url") or "").strip()
            if dt is None and url:
                if url not in detail_date_cache:
                    try:
                        detail_resp = session.get(url, timeout=20)
                        if detail_resp.ok:
                            detail_date_cache[url] = parse_date_from_html(detail_resp.text)
                        else:
                            detail_date_cache[url] = None
                    except Exception:
                        detail_date_cache[url] = None
                dt = detail_date_cache.get(url)
            if dt is None:
                dt = source_page_date
            title = str(row.get("title") or "").strip() or f"{category.name} 官方更新"
            items.append(
                {
                    "id": hashlib.sha1(f"{category.category_id}|{url}|{title}".encode("utf-8")).hexdigest(),
                    "site_id": "official",
                    "site_name": "Official",
                    "source": f"官方渠道: {label_prefix}{source_host}",
                    "title": title,
                    "url": url,
                    "published_at": iso(dt),
                    "first_seen_at": iso(now),
                    "watch_score": 90,
                    "watch_matched_terms": ["official-source"],
                }
            )

    # Dedup official entries by normalized url.
    dedup: dict[tuple[str, str], dict[str, Any]] = {}
    for item in items:
        key = (
            normalize_url(str(item.get("url") or "")),
            canonical_title(item),
        )
        existing = dedup.get(key)
        if existing is None:
            dedup[key] = item
            continue
        if item_sort_key(item) > item_sort_key(existing):
            dedup[key] = item
    return list(dedup.values()), errors


def match_item(item: dict[str, Any], category: WatchCategory) -> tuple[int, list[str]]:
    text_main = " ".join(
        [
            str(item.get("title") or ""),
            str(item.get("title_zh") or ""),
            str(item.get("title_en") or ""),
            str(item.get("source") or ""),
            str(item.get("site_name") or ""),
        ]
    ).lower()
    for kw in category.exclude_keywords:
        if keyword_hit(text_main, kw):
            return 0, []
    matched: list[str] = []
    for kw in category.keywords:
        if keyword_hit(text_main, kw):
            matched.append(kw)

    score = len(matched)
    host = host_of_url(str(item.get("url") or ""))
    for domain in category.domains:
        if domain and (host == domain or host.endswith(f".{domain}")):
            matched.append(f"domain:{domain}")
            score += 2

    # AI+科研: allow broader matching by requiring both AI and science signals.
    if category.category_id == "ai-for-science":
        ai_terms = [
            " ai ",
            "artificial intelligence",
            "llm",
            "agent",
            "模型",
            "大模型",
            "人工智能",
        ]
        science_terms = [
            "research",
            "scientific",
            "science",
            "biology",
            "biotech",
            "drug discovery",
            "molecule",
            "protein",
            "materials",
            "科研",
            "科学研究",
            "药物发现",
            "蛋白质",
            "材料发现",
            "生物",
        ]
        padded = f" {text_main} "
        has_ai = any(term in padded for term in ai_terms)
        has_science = any(term in padded for term in science_terms)
        if has_ai and has_science and "combo:ai+science" not in matched:
            matched.append("combo:ai+science")
            score += 3

    return score, matched


def item_sort_key(item: dict[str, Any]) -> tuple[str, str]:
    ts = str(item.get("published_at") or item.get("first_seen_at") or "")
    return (ts, str(item.get("id") or ""))


def build_section(items: list[dict[str, Any]], category: WatchCategory, max_items: int) -> dict[str, Any]:
    matched_rows: list[dict[str, Any]] = []
    dedup: dict[tuple[str, str], dict[str, Any]] = {}
    for item in items:
        score, matched_terms = match_item(item, category)
        if score <= 0:
            continue

        row = dict(item)
        row["watch_score"] = score
        row["watch_matched_terms"] = matched_terms
        if category.category_id == "ai-for-science":
            # AI+科研跨源转发/转载较多，优先按标题聚合去重。
            key = (canonical_title_key(row), "")
        else:
            key = (canonical_title(row), normalize_url(str(row.get("url") or "")))
        existing = dedup.get(key)
        if existing is None:
            dedup[key] = row
            continue
        existing_key = (
            int(existing.get("watch_score") or 0),
            item_sort_key(existing),
        )
        current_key = (
            int(row.get("watch_score") or 0),
            item_sort_key(row),
        )
        if current_key > existing_key:
            dedup[key] = row

    matched_rows = list(dedup.values())

    matched_rows.sort(
        key=lambda x: (
            int(x.get("watch_score") or 0),
            item_sort_key(x),
        ),
        reverse=True,
    )

    if max_items > 0:
        matched_rows = matched_rows[:max_items]

    return {
        "id": category.category_id,
        "name": category.name,
        "count": len(matched_rows),
        "items": matched_rows,
    }


def merge_section_items(items: list[dict[str, Any]], max_items: int) -> list[dict[str, Any]]:
    dedup: dict[tuple[str, str], dict[str, Any]] = {}
    for row in items:
        key = (canonical_title(row), normalize_url(str(row.get("url") or "")))
        existing = dedup.get(key)
        if existing is None:
            dedup[key] = row
            continue
        existing_key = (
            int(existing.get("watch_score") or 0),
            item_sort_key(existing),
        )
        current_key = (
            int(row.get("watch_score") or 0),
            item_sort_key(row),
        )
        if current_key > existing_key:
            dedup[key] = row

    out = list(dedup.values())
    out.sort(
        key=lambda x: (
            int(x.get("watch_score") or 0),
            item_sort_key(x),
        ),
        reverse=True,
    )
    if max_items > 0:
        out = out[:max_items]
    return out


def filter_items_by_window(items: list[dict[str, Any]], now: datetime, window_days: int) -> list[dict[str, Any]]:
    keep_after = now - timedelta(days=max(1, int(window_days)))
    out: list[dict[str, Any]] = []
    for item in items:
        ts = event_time(item)
        if not ts:
            continue
        if ts >= keep_after:
            out.append(item)
    return out


def build_payload(
    source_generated_at: str | None,
    source_topic_filter: str | None,
    source_window_hours: int | None,
    source_items: list[dict[str, Any]],
    categories: list[WatchCategory],
    max_items: int,
    output_name: str,
    window_days: int,
    session: requests.Session | None = None,
) -> dict[str, Any]:
    now = datetime.now(tz=UTC)
    strict_window = output_name == "special-focus"
    items = filter_items_by_window(source_items, now=now, window_days=window_days)
    sections: list[dict[str, Any]] = []
    official_errors: list[str] = []
    for category in categories:
        official_items: list[dict[str, Any]] = []
        if session and category.official_sources:
            official_items, errs = fetch_official_items(session, category=category, window_days=window_days)
            official_errors.extend(errs)
            if strict_window:
                official_items = filter_items_by_window(official_items, now=now, window_days=window_days)

        if category.official_only:
            section_items = []
            for it in official_items:
                row = dict(it)
                row["monitor_class"] = "official"
                row["monitor_class_label"] = "官方公告"
                section_items.append(row)
            section = {
                "id": category.category_id,
                "name": category.name,
                "count": len(section_items),
                "items": sorted(section_items, key=item_sort_key, reverse=True),
                "source_mode": "official_only",
            }
        else:
            base_section = build_section(items, category, max_items=max_items)
            base_items = []
            for it in list(base_section.get("items") or []):
                row = dict(it)
                row["monitor_class"] = "other"
                row["monitor_class_label"] = "其他来源"
                base_items.append(row)
            official_rows = []
            for it in official_items:
                row = dict(it)
                row["monitor_class"] = "official"
                row["monitor_class_label"] = "官方公告"
                official_rows.append(row)
            merged_items = merge_section_items(base_items + official_rows, max_items=max_items)
            section = {
                "id": category.category_id,
                "name": category.name,
                "count": len(merged_items),
                "items": merged_items,
                "source_mode": "mixed",
                "official_count": sum(1 for x in merged_items if x.get("monitor_class") == "official"),
                "other_count": sum(1 for x in merged_items if x.get("monitor_class") == "other"),
            }

        if max_items > 0 and len(section["items"]) > max_items:
            section["items"] = section["items"][:max_items]
            section["count"] = len(section["items"])
        sections.append(section)

    total_items = sum(int(section["count"]) for section in sections)
    return {
        "generated_at": utc_now_iso(),
        "window_days": int(window_days),
        "source_generated_at": source_generated_at,
        "source_window_hours": source_window_hours,
        "source_topic_filter": source_topic_filter,
        "output_name": output_name,
        "section_count": len(sections),
        "total_items": total_items,
        "official_error_count": len(official_errors),
        "official_errors": official_errors,
        "sections": sections,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build special focus and competitor monitor data files")
    parser.add_argument("--input", default="data/latest-24h.json", help="Input latest JSON file")
    parser.add_argument("--archive", default="data/archive.json", help="Input archive JSON file")
    parser.add_argument("--config", default="config/watchlists.json", help="Watchlist configuration JSON")
    parser.add_argument("--output-special", default="data/special-focus.json", help="Output JSON for special focus")
    parser.add_argument("--output-competitor", default="data/competitor-monitor.json", help="Output JSON for competitor monitor")
    parser.add_argument("--special-window-days", type=int, default=3, help="Window days for special focus")
    parser.add_argument("--competitor-window-days", type=int, default=7, help="Window days for competitor monitor")
    parser.add_argument("--env-file", default=".env", help="Local env file for authenticated official sources")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    load_env_file(Path(args.env_file))

    input_path = Path(args.input)
    archive_path = Path(args.archive)
    config_path = Path(args.config)
    output_special = Path(args.output_special)
    output_competitor = Path(args.output_competitor)

    latest_payload = load_json(input_path)
    archive_payload = load_json(archive_path)
    config_payload = load_json(config_path)
    archive_items = list(archive_payload.get("items") or [])

    max_items = int(config_payload.get("defaults", {}).get("max_items_per_bucket", 120) or 120)
    special_categories = normalize_categories(list(config_payload.get("special_focus") or []))
    competitor_categories = normalize_categories(list(config_payload.get("competitor_monitor") or []))
    session = create_session()

    special_payload = build_payload(
        source_generated_at=latest_payload.get("generated_at"),
        source_topic_filter=latest_payload.get("topic_filter"),
        source_window_hours=latest_payload.get("window_hours"),
        source_items=archive_items,
        categories=special_categories,
        max_items=max_items,
        output_name="special-focus",
        window_days=max(1, int(args.special_window_days)),
        session=session,
    )
    competitor_payload = build_payload(
        source_generated_at=latest_payload.get("generated_at"),
        source_topic_filter=latest_payload.get("topic_filter"),
        source_window_hours=latest_payload.get("window_hours"),
        source_items=archive_items,
        categories=competitor_categories,
        max_items=max_items,
        output_name="competitor-monitor",
        window_days=max(1, int(args.competitor_window_days)),
        session=session,
    )

    output_special.parent.mkdir(parents=True, exist_ok=True)
    output_competitor.parent.mkdir(parents=True, exist_ok=True)
    output_special.write_text(json.dumps(special_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    output_competitor.write_text(json.dumps(competitor_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote: {output_special} ({special_payload['total_items']} items)")
    print(f"Wrote: {output_competitor} ({competitor_payload['total_items']} items)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
