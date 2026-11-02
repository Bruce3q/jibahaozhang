# -*- coding: utf-8 -*-
"""在真实页面中执行 tools/smoke.js，输出通过/失败明细。

前置：无头 Edge 已在 9222 端口运行，预览服务器在 5178。
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shoot import CDP, DEBUG, new_target  # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:5178/index.html?empty=1")
    ap.add_argument("--out", default="shots/smoke-result.json")
    args = ap.parse_args()

    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "smoke.js"), "r", encoding="utf-8") as f:
        script = f.read()

    tid = new_target("about:blank")
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
    c.send("Page.navigate", url=args.url)
    time.sleep(1.2)

    # 清理 Service Worker / 缓存，确保测试的是最新代码
    c.eval(
        "(async()=>{try{const rs=await navigator.serviceWorker.getRegistrations();"
        "await Promise.all(rs.map(r=>r.unregister()));"
        "const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)));"
        "return 'cleared'}catch(e){return String(e)}})()",
        await_promise=True,
    )
    c.send("Page.reload", ignoreCache=True)
    time.sleep(1.0)

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

    print(f"通过 {data.get('pass', 0)} 项，失败 {data.get('fail', 0)} 项")
    if data.get("error"):
        print("异常：", data["error"][:1200])
    for r in data.get("results", []):
        if not r.get("ok"):
            print(f"  ✗ {r.get('name')}  {r.get('detail', '')}")
    return 0 if data.get("fail", 1) == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
