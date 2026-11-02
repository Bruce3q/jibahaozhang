# -*- coding: utf-8 -*-
"""v1.6.1 九项需求回归：在真实页面执行 tools/v161check.js。

前置：无头 Edge 在 9222、预览服务器在 5178。
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shoot import CDP, new_target  # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:5178/index.html?empty=1")
    ap.add_argument("--out", default="shots/v161check-result.json")
    args = ap.parse_args()

    cdp = CDP(new_target(args.url))
    cdp.call("Runtime.enable")
    cdp.call("Emulation.setDeviceMetricsOverride", {
        "width": 390, "height": 844, "deviceScaleFactor": 2, "mobile": True,
    })
    cdp.call("Page.enable")
    cdp.call("Page.reload", {"ignoreCache": True})
    cdp.wait(2.0)

    js = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "v161check.js"), encoding="utf-8").read()
    res = cdp.call("Runtime.evaluate", {"expression": js, "awaitPromise": True, "returnByValue": True})
    raw = res.get("result", {}).get("value")
    print(raw)
    if raw:
        data = json.loads(raw)
        os.makedirs(os.path.dirname(args.out), exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("通过 {0}/{1}".format(data["pass"], data["total"]))
        if data["fail"]:
            print("失败：", "；".join(data["fail"]))
            sys.exit(1)
    cdp.close()


if __name__ == "__main__":
    main()