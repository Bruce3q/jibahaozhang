# -*- coding: utf-8 -*-
"""v1.6.2 删除桌面小组件回归：在真实页面执行 tools/v162check.js。"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shoot import CDP, new_target  # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:5178/index.html?empty=1")
    ap.add_argument("--out", default="shots/v162check-result.json")
    args = ap.parse_args()

    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "v162check.js"), "r", encoding="utf-8") as f:
        script = f.read()

    c = CDP(new_target("about:blank"))
    c.send("Page.enable")
    c.send("Runtime.enable")
    c.send(
        "Emulation.setDeviceMetricsOverride",
        width=390, height=844, deviceScaleFactor=2, mobile=True,
        screenWidth=390, screenHeight=844,
    )
    c.send("Page.navigate", url=args.url)
    time.sleep(1.2)
    c.eval(
        "(async()=>{try{const rs=await navigator.serviceWorker.getRegistrations();"
        "await Promise.all(rs.map(r=>r.unregister()));"
        "const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)));"
        "return 'cleared'}catch(e){return String(e)}})()",
        await_promise=True,
    )
    c.send("Page.reload", ignoreCache=True)
    time.sleep(1.2)

    raw = c.eval(script, await_promise=True)
    c.ws.close()

    try:
        data = json.loads(raw)
    except Exception:
        print("无法解析测试输出：")
        print(raw)
        return 2

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("通过 {0} 项，失败 {1} 项".format(data.get("pass", 0), data.get("fail", 0)))
    if data.get("error"):
        print("异常：", data["error"][:1200])
    for r in data.get("results", []):
        if not r.get("ok"):
            print("  x {0}  {1}".format(r.get("name"), r.get("detail", "")))
    return 0 if data.get("fail", 1) == 0 else 1


if __name__ == "__main__":
    sys.exit(main())