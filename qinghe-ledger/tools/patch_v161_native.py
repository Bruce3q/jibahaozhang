import io

p = 'android/app/src/main/java/com/qinghe/ledger/MainActivity.java'
s = io.open(p, encoding='utf-8').read()


def rep(old, new):
    global s
    assert old in s, 'missing: ' + old[:100]
    s = s.replace(old, new, 1)


rep(""" * 3. QHNotify 桥负责「通知自动记账」开关、通知使用权、悬浮窗与系统通知；
 * 4. 微信支付/收款通知由 WeChatNotificationListenerService 在本机解析，确认后才入账。""",
    """ * 3. QHNotify 桥只负责本地提醒所需的系统通知权限；
 * 4. QHQuick 桥负责悬浮球 / 通知栏快捷 / 桌面小组件 / 磁贴入口，统一走本地队列入账。""")

rep("""    private String deliveringJson = "";
    private String lastDeliveredJson = "";
    private long lastDeliveredAt = 0;
""", "")

rep("""                ui.postDelayed(new Runnable() {
                    @Override public void run() { deliverPendingNotify(); }
                }, 500);
""", "")

rep("""        // 监听服务被系统回收后，回到 App 时自动尝试重新绑定
        WeChatNotificationListenerService.ensureRebindIfNeeded(this);
        ui.postDelayed(new Runnable() {
            @Override public void run() { deliverPendingNotify(); }
        }, 300);
""", "")

rep("""            String data = intent.getStringExtra("notify");
            if (data == null) data = intent.getStringExtra("recognition");   // 兼容旧版通知
            if (data != null) {
                deliverNotify(data, intent.getBooleanExtra("auto_commit", false));
            }
            if (intent.getBooleanExtra("quick_add", false)) {
                openQuickPanel();
            }""",
    """            if (intent.getBooleanExtra("quick_add", false)) {
                openAddOnReady = true;
            }""")

# 删除通知投递相关方法（deliverNotify / deliverNotifyAttempt / deliverPendingNotify）
start = s.index("    private void deliverNotify(final String json, final boolean autoCommit) {")
end = s.index("    @Override\n    protected void onActivityResult")
s = s[:start] + s[end:]

# 通知桥只保留本地提醒需要的部分
start = s.index("    /** JS 桥：通知自动记账开关、通知使用权、悬浮窗与系统通知。 */")
end = s.index("    // ---------- 快速记账")
new_bridge = '''    /** JS 桥：本地提醒所需的系统通知权限（不读取任何通知内容）。 */
    public class NotifyBridge {

        @JavascriptInterface
        public void openSettings(String kind) {
            Intent intent;
            try {
                if ("overlay".equals(kind)) {
                    intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            Uri.parse("package:" + getPackageName()));
                } else if ("battery".equals(kind)) {
                    intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                            Uri.parse("package:" + getPackageName()));
                } else if ("notifications".equals(kind)) {
                    intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                    intent.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                } else {
                    intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.parse("package:" + getPackageName()));
                }
                startActivity(intent);
            } catch (Exception e) {
                toast("无法打开系统设置，请在系统设置中手动开启");
            }
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            if (Build.VERSION.SDK_INT < 33) return;
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return;
            SharedPreferences sp = getSharedPreferences("qinghe_notify", MODE_PRIVATE);
            if (sp.getBoolean("asked", false)) {
                openSettings("notifications");
                return;
            }
            sp.edit().putBoolean("asked", true).apply();
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 9);
        }

        @JavascriptInterface
        public void notify(String title, String body, String tag) {
            if (Build.VERSION.SDK_INT >= 33 &&
                    checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return;
            }
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            String channelId = "qinghe_reminders";
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel channel = new NotificationChannel(
                        channelId, "记账提醒", NotificationManager.IMPORTANCE_DEFAULT);
                channel.setDescription("每日记账、消费小结与周期总结");
                nm.createNotificationChannel(channel);
            }
            Intent open = new Intent(MainActivity.this, MainActivity.class);
            open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pi = PendingIntent.getActivity(
                    MainActivity.this, 0, open,
                    Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
            Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                    ? new Notification.Builder(MainActivity.this, channelId)
                    : new Notification.Builder(MainActivity.this);
            builder.setSmallIcon(android.R.drawable.ic_popup_reminder)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new Notification.BigTextStyle().bigText(body))
                    .setAutoCancel(true)
                    .setContentIntent(pi);
            int id = (tag == null || tag.isEmpty()) ? 1001 : tag.hashCode();
            nm.notify(id, builder.build());
        }

        @JavascriptInterface
        public boolean notificationGranted() {
            if (Build.VERSION.SDK_INT < 33) return true;
            return checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
    }

'''
s = s[:start] + new_bridge + s[end:]

# 浮窗桥：删相册权限，加小组件配置
rep("""        @JavascriptInterface
        public boolean hasGalleryPermission() { return ScreenshotOcr.hasPermission(MainActivity.this); }

""", "")

rep("""                if ("gallery".equals(k)) {
                    QuickPermissionActivity.request(MainActivity.this);
                    return;
                }
""", "")

rep("""        @JavascriptInterface
        public boolean overlayGranted() { return QuickStore.canOverlay(MainActivity.this); }
""",
    """        @JavascriptInterface
        public boolean overlayGranted() { return QuickStore.canOverlay(MainActivity.this); }

        @JavascriptInterface
        public String getWidgetConfig() { return QuickStore.widgetConfigJson(MainActivity.this); }

        @JavascriptInterface
        public void setWidgetConfig(String json) {
            QuickStore.applyWidgetConfig(MainActivity.this, json);
            QuickWidgetProvider.refreshAll(MainActivity.this);
        }
""")

# 磁贴 / 通知栏入口：页面就绪后再打开记账面板
rep("""    private String deliveringQuick = "";
""", """    private String deliveringQuick = "";
    private boolean openAddOnReady = false;
""")

rep("""        QuickWidgetProvider.refreshAll(this);
        webView.loadUrl(START_URL);""",
    """        QuickWidgetProvider.refreshAll(this);
        openAddOnReady = getIntent() != null && getIntent().getBooleanExtra("quick_add", false);
        webView.loadUrl(START_URL);""")

rep("""                ui.postDelayed(new Runnable() {
                    @Override public void run() { deliverPendingQuick(); }
                }, 800);""",
    """                ui.postDelayed(new Runnable() {
                    @Override public void run() { deliverPendingQuick(); }
                }, 800);
                if (openAddOnReady) {
                    openAddOnReady = false;
                    ui.postDelayed(new Runnable() {
                        @Override public void run() { openQuickPanel(); }
                    }, 30);
                }""")

io.open(p, 'w', encoding='utf-8').write(s)
print('MainActivity patched')