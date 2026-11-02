# -*- coding: utf-8 -*-
import sys, time
sys.path.insert(0, 'tools')
from shoot import CDP, new_target
tid = new_target('about:blank')
c = CDP(tid)
c.send('Page.enable'); c.send('Runtime.enable')
c.send('Network.enable'); c.send('Network.setCacheDisabled', cacheDisabled=True)
c.send('Emulation.setDeviceMetricsOverride', width=390, height=844, deviceScaleFactor=2, mobile=True, screenWidth=390, screenHeight=844)
c.send('Page.navigate', url='http://127.0.0.1:5178/index.html?tab=me&v=164')
time.sleep(1.8)
print('title:', c.eval('document.title'))
print('h1:', c.eval("(document.querySelector('.about h1')||{}).textContent||''"))
c.eval("window.scrollTo(0, document.body.scrollHeight)")
time.sleep(0.6)
c.shot('shots/v164-about.png')
print('saved')
