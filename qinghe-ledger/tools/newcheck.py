# -*- coding: utf-8 -*-
"""加载新版页面并执行 newcheck.js 的交互检查。"""
from __future__ import annotations

import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shoot import CDP, new_target  # noqa: E402

BASE = "http://127.0.0.1:5178/index.html"


def main():
    tid = new_target(BASE)
    c = CDP(tid)
    c.send("Page.enable")
    c.send("Runtime.enable")
    c.send(
        "Emulation.setDeviceMetricsOverride",
        width=390,
        height=844,
        deviceScaleFactor=2,
        mobile=True,
        screenWidth=390,
        screenHeight=844,
    )
    c.send("Page.navigate", url=BASE)
    time.sleep(1.3)
    c.eval(
        "(async()=>{try{const rs=await navigator.serviceWorker.getRegistrations();"
        "await Promise.all(rs.map(r=>r.unregister()));"
        "const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)));"
        "return 'cleared'}catch(e){return String(e)}})()",
        await_promise=True,
    )
    c.send("Page.reload", ignoreCache=True)
    time.sleep(1.2)

    js = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "newcheck.js"), encoding="utf-8").read()
    raw = c.eval(js, await_promise=True)
    c.ws.close()
    out = json.loads(raw)
    print(json.dumps(out, ensure_ascii=False, indent=2))
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shots", "newcheck.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
