# -*- coding: utf-8 -*-
import sys, time
sys.path.insert(0, 'tools')
from shoot import CDP, new_target
tid = new_target('about:blank')
c = CDP(tid)
c.send('Page.enable'); c.send('Runtime.enable')
c.send('Emulation.setDeviceMetricsOverride', width=390, height=844, deviceScaleFactor=2, mobile=True, screenWidth=390, screenHeight=844)
c.send('Page.navigate', url='http://127.0.0.1:5178/index.html?tab=calendar')
time.sleep(2.0)
print(c.eval("(function(){try{QH.Store.loadDemo();var d=new Date();var t=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');[{c:'breakfast',a:12,n:'豆浆油条'},{c:'lunch',a:28,n:'公司楼下面馆'},{c:'laundry',a:15,n:'干洗外套'}].forEach(function(x){QH.Store.addTransaction({type:'expense',category:x.c,amount:x.a,note:x.n,date:t,time:'12:00'});});QHApp.goTab('calendar');QHApp.goDay(t);return 'ok'}catch(e){return String(e)}})()"))
time.sleep(0.9)
c.shot('shots/v163-calendar.png')
print('saved')
