# -*- coding: utf-8 -*-
"""「辣脚记账」→「记把好账」：只改应用名称相关文本与版本号。
包名、localStorage key、prefs、图标路径、业务逻辑全部不动。"""
import io, re

NEW = '记把好账'

def patch(path, pairs, must=True):
    raw = io.open(path, 'rb').read()
    crlf = b'\r\n' in raw
    s = raw.decode('utf-8').replace('\r\n', '\n')
    for old, new in pairs:
        n = s.count(old)
        print('%-55s %-30s x%d' % (path, old[:26], n))
        if must and n == 0:
            raise SystemExit('missing: %s in %s' % (old, path))
        s = s.replace(old, new)
    if crlf:
        s = s.replace('\n', '\r\n')
    io.open(path, 'wb').write(s.encode('utf-8'))

# 1) 安卓应用名
patch('android/app/src/main/res/values/strings.xml', [('<string name="app_name">辣脚记账</string>',
                                                       '<string name="app_name">%s</string>' % NEW)])

# 2) 清单版本号（覆盖安装用，包名不动）
patch('android/app/src/main/AndroidManifest.xml', [
    ('android:versionCode="19"', 'android:versionCode="20"'),
    ('android:versionName="1.6.3"', 'android:versionName="1.6.4"'),
])

# 3) 前端所有硬编码名称 + 版本号 + 导出文件名
patch('js/app.js', [
    ('辣脚记账', NEW),
    ('%s v1.6.3' % NEW, '%s v1.6.4' % NEW),
])
patch('js/store.js', [('辣脚记账', NEW)])
patch('js/util.js', [('辣脚记账', NEW)])
patch('js/charts.js', [('辣脚记账', NEW)])
patch('js/importer.js', [('辣脚记账', NEW)])
patch('index.html', [('辣脚记账', NEW)])
patch('manifest.webmanifest', [('"name": "辣脚记账"', '"name": "%s"' % NEW),
                               ('"short_name": "辣脚"', '"short_name": "%s"' % NEW)])

print('done')
