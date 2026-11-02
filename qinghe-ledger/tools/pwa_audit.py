# -*- coding: utf-8 -*-
"""检查 PWA 清单、Service Worker 与安装条件（需先启动 CDP Edge）。"""
from __future__ import annotations

import json
import sys
import time

from shoot import CDP, new_target

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5178/dist/pwa/"

tid = new_target(URL)
c = CDP(tid)
time.sleep(1.8)

manifest = c.send("Page.getAppManifest")
print("manifest.url:", manifest.get("url"))
print("manifest.errors:", json.dumps(manifest.get("errors", []), ensure_ascii=False))
print("installability:", json.dumps(c.send("Page.getInstallabilityErrors"), ensure_ascii=False))
print("sw.count:", c.eval("navigator.serviceWorker.getRegistrations().then(r=>r.length)", await_promise=True))
print("sw.controller:", c.eval("!!navigator.serviceWorker.controller"))
print("display:", c.eval("matchMedia('(display-mode: standalone)').matches"))
