# -*- coding: utf-8 -*-
import sys, time
sys.path.insert(0, 'tools')
from shoot import CDP, new_target

url, out = sys.argv[1], sys.argv[2]
tid = new_target('about:blank')
c = CDP(tid)
c.send('Page.enable'); c.send('Runtime.enable')
c.send('Emulation.setDeviceMetricsOverride', width=390, height=844, deviceScaleFactor=2, mobile=True, screenWidth=390, screenHeight=844)
c.send('Page.navigate', url=url)
time.sleep(2.2)
c.shot(out)
print('saved', out)
