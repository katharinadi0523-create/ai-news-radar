#!/usr/bin/env python3
"""Serve the static site immediately, then refresh datasets in background."""

from __future__ import annotations

import argparse
import functools
import http.server
import os
import socketserver
import subprocess
import sys
import threading
from datetime import datetime
from pathlib import Path


def log(message: str, *, error: bool = False) -> None:
    stream = sys.stderr if error else sys.stdout
    stamp = datetime.now().strftime("%H:%M:%S")
    print(f"[serve_local {stamp}] {message}", file=stream, flush=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Serve the local static site immediately, then refresh data in background",
    )
    parser.add_argument("--host", default="127.0.0.1", help="Bind host")
    parser.add_argument("--port", type=int, default=8080, help="Bind port")
    parser.add_argument("--window-hours", type=int, default=24, help="Window passed to update_news.py")
    parser.add_argument("--archive-days", type=int, default=45, help="Archive retention passed to update_news.py")
    parser.add_argument(
        "--translate-max-new",
        type=int,
        default=80,
        help="Max new EN->ZH translations passed to update_news.py",
    )
    parser.add_argument(
        "--rss-opml",
        default="feeds/follow.opml",
        help="OPML path to include for RSS fetching; ignored if the file does not exist",
    )
    parser.add_argument(
        "--rss-max-feeds",
        type=int,
        default=0,
        help="Optional max OPML RSS feeds to fetch (0 means all)",
    )
    parser.add_argument(
        "--env-file",
        default=".env",
        help="Env file passed to build_watchlists.py",
    )
    parser.add_argument(
        "--skip-watchlists",
        action="store_true",
        help="Skip build_watchlists.py before serving",
    )
    parser.add_argument(
        "--skip-refresh",
        action="store_true",
        help="Skip data refresh and only serve existing static files",
    )
    return parser.parse_args()


def run_step(cmd: list[str], cwd: Path) -> None:
    log(f"Running: {' '.join(cmd)}")
    process = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    assert process.stdout is not None
    for line in process.stdout:
        text = line.rstrip()
        if text:
            log(f"  {text}")
    returncode = process.wait()
    if returncode != 0:
        raise subprocess.CalledProcessError(returncode, cmd)


def refresh_data(project_root: Path, args: argparse.Namespace) -> None:
    python_bin = sys.executable
    update_cmd = [
        python_bin,
        "scripts/update_news.py",
        "--output-dir",
        "data",
        "--window-hours",
        str(args.window_hours),
        "--archive-days",
        str(args.archive_days),
        "--translate-max-new",
        str(args.translate_max_new),
        "--rss-max-feeds",
        str(args.rss_max_feeds),
    ]

    opml_path = project_root / args.rss_opml
    if args.rss_opml and opml_path.exists():
        update_cmd.extend(["--rss-opml", args.rss_opml])
    elif args.rss_opml:
        log(f"Skip RSS OPML because file does not exist: {opml_path}")

    log("Phase 1/2: news refresh started")
    run_step(update_cmd, project_root)
    log("Phase 1/2: news refresh finished")

    if args.skip_watchlists:
        log("Phase 2/2: watchlist build skipped by flag")
        return

    watchlist_cmd = [
        python_bin,
        "scripts/build_watchlists.py",
        "--env-file",
        args.env_file,
    ]
    log("Phase 2/2: watchlist build started")
    run_step(watchlist_cmd, project_root)
    log("Phase 2/2: watchlist build finished")


def refresh_data_async(project_root: Path, args: argparse.Namespace) -> threading.Thread:
    def runner() -> None:
        try:
            log("Background refresh started")
            refresh_data(project_root, args)
            log("Background refresh completed successfully")
        except subprocess.CalledProcessError as exc:
            log(f"Background refresh failed with exit code {exc.returncode}", error=True)
        except Exception as exc:  # pragma: no cover - defensive logging
            log(f"Background refresh crashed: {exc}", error=True)

    thread = threading.Thread(target=runner, name="local-refresh", daemon=True)
    thread.start()
    return thread


def serve(project_root: Path, host: str, port: int) -> None:
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(project_root))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer((host, port), handler) as httpd:
        log(f"Service started at http://{host}:{port}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            log("Stopped")


def main() -> int:
    args = parse_args()
    project_root = Path(__file__).resolve().parent.parent
    os.chdir(project_root)

    if not args.skip_refresh:
        refresh_data_async(project_root, args)
    else:
        log("Background refresh skipped by flag")

    serve(project_root, args.host, args.port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
