# -*- coding: utf-8 -*-
"""为 v1.5.0 通知自动记账截两张图：设置弹窗与确认卡（注入 QHNotify mock）。"""
from __future__ import annotations

import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shoot import CDP, new_target  # noqa: E402

MOCK = r"""
(function () {
  var enabled = true;
  window.QHNotify = {
    isEnabled: function () { return enabled; },
    setEnabled: function (v) { enabled = !!v; return enabled; },
    isAccessGranted: function () { return true; },
    overlayGranted: function () { return false; },
    openSettings: function () { return true; },
    notificationGranted: function () { return true; },
    requestNotificationPermission: function () { return true; },
    notify: function () { return true; },
    lastConnected: function () { return Date.now(); }
  };
})();
"""


def shot(c, out):
    res = c.send("Page.captureScreenshot", format="png", captureBeyondViewport=False)
    import base64
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "wb") as f:
        f.write(base64.b64decode(res["data"]))
    print("saved", out)


def main():
    c = CDP(new_target("about:blank"))
    c.send("Page.enable")
    c.send("Runtime.enable")
    c.send("Page.addScriptToEvaluateOnNewDocument", source=MOCK)
    c.send("Emulation.setDeviceMetricsOverride", width=390, height=844, deviceScaleFactor=2,
           mobile=True, screenWidth=390, screenHeight=844)
    c.send("Page.navigate", url="http://127.0.0.1:5178/index.html?empty=1")
    time.sleep(1.2)
    c.eval("(async()=>{const rs=await navigator.serviceWorker.getRegistrations();"
           "await Promise.all(rs.map(r=>r.unregister()));const ks=await caches.keys();"
           "await Promise.all(ks.map(k=>caches.delete(k)));return 1})()", await_promise=True)
    c.send("Page.reload", ignoreCache=True)
    time.sleep(1.2)

    c.eval("QHApp.goTab('me')")
    time.sleep(0.5)
    c.eval("document.querySelector('[data-action=\"open-notify\"]').click()")
    time.sleep(0.6)
    shot(c, "shots/v150-notify.png")

    c.eval("document.querySelector('[data-action=\"close-notify\"]').click()")
    time.sleep(0.5)
    c.eval("QHApp.showConfirmCard({amount:4.5,merchant:'香香水果店',category:'shopping',type:'expense',date:QH.Utils.today(),time:'12:31'})")
    time.sleep(0.6)
    shot(c, "shots/v150-confirm.png")
    c.ws.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())