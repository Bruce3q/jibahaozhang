# -*- coding: utf-8 -*-
import sys, time, base64
sys.path.insert(0, 'tools')
from shoot import CDP, new_target

out = 'dist/更新指南-v1.6.3.jpg'
tid = new_target('about:blank')
c = CDP(tid)
c.send('Page.enable'); c.send('Runtime.enable')
c.send('Network.enable'); c.send('Network.setCacheDisabled', cacheDisabled=True)
c.send('Emulation.setDeviceMetricsOverride', width=750, height=1200, deviceScaleFactor=1, mobile=True, screenWidth=750, screenHeight=1200)
c.send('Page.navigate', url='http://127.0.0.1:5178/docs/poster-v1.6.3.html')
time.sleep(2.2)
m = c.send('Page.getLayoutMetrics')
size = m.get('cssContentSize') or m.get('contentSize')
h = int(size['height'])
print('height', h)
res = c.send('Page.captureScreenshot', format='jpeg', quality=90, captureBeyondViewport=True,
             clip={'x': 0, 'y': 0, 'width': 750, 'height': h, 'scale': 1.5})
open(out, 'wb').write(base64.b64decode(res['data']))
print('saved', out)
