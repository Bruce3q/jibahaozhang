# -*- coding: utf-8 -*-
import sys, time
sys.path.insert(0, 'tools')
from shoot import CDP, new_target

tid = new_target('about:blank')
c = CDP(tid)
c.send('Page.enable'); c.send('Runtime.enable')
c.send('Emulation.setDeviceMetricsOverride', width=390, height=844, deviceScaleFactor=2, mobile=True, screenWidth=390, screenHeight=844)
c.send('Page.navigate', url='http://127.0.0.1:5178/index.html?tab=stats')
time.sleep(2.0)
c.eval("(function(){try{QH.Store.loadDemo();QHApp.render();return 'demo'}catch(e){return String(e)}})()")
time.sleep(0.6)
c.eval("(function(){var el=document.querySelector('.cum-card');if(el)el.scrollIntoView({block:'center'});return el?el.getBoundingClientRect().top:-1})()")
time.sleep(0.5)
c.shot('shots/v163-cum.png')
print('saved shots/v163-cum.png')
