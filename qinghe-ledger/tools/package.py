# -*- coding: utf-8 -*-
"""打包可分发源码（排除开发截图、浏览器配置与测试缓存）。

用法：
    python tools/package.py
输出：
    dist/记把好账-源码.zip
"""
from __future__ import annotations

import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "记把好账-源码.zip"

INCLUDE_FILES = [
    "index.html",
    "manifest.webmanifest",
    "sw.js",
    "serve.py",
    "README.md",
]
INCLUDE_DIRS = ["css", "js", "assets", "tools", "android", "docs", "dist"]
EXCLUDE_DIRS = {"shots", "__pycache__", "pylib", "cdp-profile"}
EXCLUDE_SUFFIXES = {".pyc", ".zip"}


def want(path: Path) -> bool:
    if any(part in EXCLUDE_DIRS for part in path.parts):
        return False
    if path.suffix in EXCLUDE_SUFFIXES:
        return False
    if path.name in {".DS_Store", "Thumbs.db"}:
        return False
    # dist 只保留单文件网页；APK 体积大，作为独立产物单独分发
    if path.parts and path.parts[0] == "dist":
        if path.parts[1:2] == ("archive",):
            return False
        if path.suffix in (".html", ".zip", ".apk", ".idsig"):
            return False
    # 排除 DSH 文件工具的临时锁文件与其它隐藏文件
    if path.name.startswith("."):
        return False
    return True


def main() -> None:
    OUT.parent.mkdir(exist_ok=True)
    count = 0
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for name in INCLUDE_FILES:
            p = ROOT / name
            if p.exists():
                zf.write(p, f"qinghe-ledger/{name}")
                count += 1
        for name in INCLUDE_DIRS:
            base = ROOT / name
            if not base.exists():
                continue
            for p in sorted(base.rglob("*")):
                if not p.is_file() or not want(p.relative_to(ROOT)):
                    continue
                zf.write(p, f"qinghe-ledger/{p.relative_to(ROOT).as_posix()}")
                count += 1
    print(f"已生成：{OUT}（{OUT.stat().st_size / 1024:.1f} KB，{count} 个文件）")


if __name__ == "__main__":
    main()
