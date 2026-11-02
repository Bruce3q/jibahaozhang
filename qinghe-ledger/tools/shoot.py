# -*- coding: utf-8 -*-
"""通过 Chrome DevTools Protocol 对页面做精确手机尺寸截图 / 交互检查。

前置：已启动带 --remote-debugging-port=9222 的无头 Edge。
用法：
    python tools/shoot.py --url http://127.0.0.1:5178/index.html --out shots/home.png
    python tools/shoot.py --url ... --out ... --eval "QHApp.openAdd('breakfast')" --wait 500
    python tools/shoot.py --url ... --out ... --dark --full
"""
from __future__ import annotations

import argparse
import base64
import json
import time
import urllib.parse
import urllib.request

import websocket

DEBUG = "http://127.0.0.1:9222"


def new_target(url: str = "about:blank") -> str:
    req = urllib.request.Request(f"{DEBUG}/json/new?{urllib.parse.quote(url, safe='')}", method="PUT")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())["id"]


def ws_url(target_id: str) -> str:
    with urllib.request.urlopen(f"{DEBUG}/json/list") as r:
        for t in json.loads(r.read()):
            if t["id"] == target_id:
                return t["webSocketDebuggerUrl"]
    raise RuntimeError("target not found")


class CDP:
    def __init__(self, target_id: str):
        self.ws = websocket.create_connection(ws_url(target_id), timeout=30)
        self.mid = 0
        self.events = []

    def send(self, method, **params):
        self.mid += 1
        self.ws.send(json.dumps({"id": self.mid, "method": method, "params": params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == self.mid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})
            self.events.append(msg)

    def eval(self, expr, await_promise=False):
        res = self.send(
            "Runtime.evaluate",
            expression=expr,
            returnByValue=True,
            awaitPromise=await_promise,
        )
        return res.get("result", {}).get("value")

    def shot(self, path, full=False):
        params = {"format": "png", "fromSurface": True, "captureBeyondViewport": full}
        if full:
            metrics = self.send("Page.getLayoutMetrics")
            size = metrics.get("cssContentSize") or metrics.get("contentSize") or {}
            params["clip"] = {
                "x": 0,
                "y": 0,
                "width": size.get("width", 390),
                "height": size.get("height", 844),
                "scale": 1,
            }
        data = self.send("Page.captureScreenshot", **params)["data"]
        with open(path, "wb") as f:
            f.write(base64.b64decode(data))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:5178/index.html")
    ap.add_argument("--out", required=True)
    ap.add_argument("--width", type=int, default=390)
    ap.add_argument("--height", type=int, default=844)
    ap.add_argument("--wait", type=int, default=900, help="导航后等待毫秒")
    ap.add_argument("--eval", default="", help="截图前执行的 JS")
    ap.add_argument("--dark", action="store_true")
    ap.add_argument("--full", action="store_true", help="整页长截图")
    ap.add_argument("--keep-sw", action="store_true", help="保留 Service Worker 缓存（默认清理，便于开发）")
    ap.add_argument("--mobile", action="store_true", default=True)
    args = ap.parse_args()

    tid = new_target("about:blank")
    c = CDP(tid)
    c.send("Page.enable")
    c.send("Runtime.enable")
    c.send(
        "Emulation.setDeviceMetricsOverride",
        width=args.width,
        height=args.height,
        deviceScaleFactor=2,
        mobile=True,
        screenWidth=args.width,
        screenHeight=args.height,
    )
    if args.dark:
        c.send("Emulation.setEmulatedMedia", features=[{"name": "prefers-color-scheme", "value": "dark"}])

    c.send("Page.navigate", url=args.url)
    time.sleep(args.wait / 1000)

    if not args.keep_sw:
        # 开发时清掉 Service Worker 与旧缓存，避免看到上一版样式
        c.eval(
            "(async()=>{try{const rs=await navigator.serviceWorker.getRegistrations();"
            "await Promise.all(rs.map(r=>r.unregister()));"
            "const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)));"
            "return 'cleared'}catch(e){return String(e)}})()",
            await_promise=True,
        )
        c.send("Page.reload", ignoreCache=True)
        time.sleep(args.wait / 1000)

    if args.eval:
        val = c.eval(args.eval, await_promise=True)
        print("eval =>", val)
        time.sleep(0.45)

    c.shot(args.out, full=args.full)
    print("saved", args.out)
    c.ws.close()


if __name__ == "__main__":
    main()
