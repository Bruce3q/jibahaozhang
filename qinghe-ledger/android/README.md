# 辣脚记账 Android 壳工程（v1.6.3）

WebView 壳 + 本地单文件页面。所有账目仍然写入 WebView 的 localStorage，原生层只提供快捷入口与系统权限能力，不额外存账单。

## 目录

```
android/app/src/main/
├── AndroidManifest.xml                 # versionCode 19 / versionName 1.6.3
├── java/com/qinghe/ledger/
│   ├── MainActivity.java               # WebView、QHAndroid / QHQuick 桥、待入账队列投递
│   ├── QuickStore.java                 # 快捷入口队列、今日笔数、开关（prefs: qinghe_quick）
│   ├── QuickAddReceiver.java           # 通知栏按钮广播
│   ├── QuickNotification.java          # 通知栏常驻「记一笔 / 早餐¥10 / 午餐¥20」
│   ├── QuickTileService.java           # 状态栏磁贴「记一笔」（QS Tile）
│   └── FloatingBallService.java        # 悬浮球 + 快捷记账小窗（吸边、收起、三合一记录）
├── assets/index.html                   # build_single.py 生成后复制进来
└── res/                                # 图标、strings、透明主题
```

## 快捷入口链路

```
悬浮球 / 磁贴 / 通知栏按钮 / 小窗保存
        ↓
QuickStore.enqueue(json)  （SharedPreferences 队列，最多 100 条）
        ↓
MainActivity.pushQuickToApp()  →  deliverPendingQuick()
        ↓
WebView: window.QHApp.commitQuick(json)  →  Store.addTransactions()  →  返回 true 出队
```

App 未打开时队列保留，下次打开自动逐条投递；时间字段由原生生成（当前时间），不会把「现在记的」记错日期。

## 构建

```bash
# 1. 生成单文件页面
python tools/build_single.py
cp dist/辣脚记账.html android/app/src/main/assets/index.html

# 2. 打包 APK（无需 Gradle）
bash tools/build_apk_v162.sh
```

依赖：JDK 17（`android-build/sdk/jdk-17.0.20.1+1`）、Android platform 34、build-tools 34（`android-build/sdk/android-14`）；签名参数在 `tools/build_apk_v162.sh` 顶部。

## 权限与边界

- `SYSTEM_ALERT_WINDOW`：只用于悬浮球和悬浮记账小窗；未授权时降级为通知栏，不弹拦截式权限流程。
- `POST_NOTIFICATIONS`：Android 13+ 通知栏常驻入口与记账提醒。
- `FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_SPECIAL_USE`：悬浮球常驻。
- 不申请无障碍、不录屏、不读相册、不联网同步；WebView 的 localStorage 是唯一数据源。
- v1.6.2 已整体删除桌面小组件（AppWidgetProvider / RemoteViews / 配置 / 布局），磁贴与悬浮球不受影响。
- v1.6.3 只改数据与网页层：累计结余按月切换、备注搜索时段、新增洗衣分类；Android 侧仅版本号变化。
