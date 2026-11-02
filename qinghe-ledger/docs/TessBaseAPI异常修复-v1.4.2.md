# TessBaseAPI 异常修复（v1.4.2）

## 1. 根因判断

这是**原生库文件名不匹配**，不是训练包缺失，也不是画面模糊。

Tesseract4Android 的 Java 静态初始化代码固定加载 4 个库：

```java
System.loadLibrary("jpgt");
System.loadLibrary("pngt");
System.loadLibrary("lept");
System.loadLibrary("tess");
```

但项目引入的 `tesseract4android.aar` 里，`.so` 实际叫：

```text
libjpeg.so
libpngx.so
libleptonica.so
libtesseract.so
```

`System.loadLibrary("tess")` 找不到 `libtess.so`，`TessBaseAPI` 类初始化失败；后续再次访问该类时 ART 抛出 `NoClassDefFoundError`，其 message 正是 `com.googlecode.tesseract.android.TessBaseAPI`，旧代码把它直接显示在 toast 里，所以看起来像“Tesseract 自己报错”。

## 2. 需要修改的文件清单

| 文件 | 修改 |
| --- | --- |
| `tools/build_apk.sh` | 打包时保留原 `.so`（DT_NEEDED 依赖原名），并补充 `libjpgt/libpngt/liblept/libtess` 别名 |
| `android/.../OcrEngine.java` | 打印模型路径/大小/rev、初始化返回值、Bitmap 尺寸；模型缺失或 init 失败时重拷并重试一次；统一异常信息 |
| `android/.../GalleryOcrService.java` | Bitmap 空/无效前置校验；裁剪前后日志；完整堆栈写日志；用户侧统一友好文案；释放 crop |
| `AndroidManifest.xml` | versionCode 14 / versionName 1.4.2 |
| `js/app.js`、`sw.js` | 版本号 v1.4.2 / `qinghe-v17` |

## 3. 完整 diff

### 3.1 `tools/build_apk.sh`

```diff
 with zipfile.ZipFile(dst, 'a', zipfile.ZIP_DEFLATED) as z:
     z.write(dex, 'classes.dex')
     with zipfile.ZipFile(aar) as a:
+        # Tesseract4Android 的 Java 侧 loadLibrary 名字与 AAR 内文件名不一致：
+        # 它加载 jpgt/pngt/lept/tess，而 AAR 里是 libjpeg/libpngx/libleptonica/libtesseract。
+        # 保留原名（DT_NEEDED 依赖它们），同时补上 Java 需要的别名。
+        alias = {
+            'libjpeg.so': 'libjpgt.so',
+            'libpngx.so': 'libpngt.so',
+            'libleptonica.so': 'liblept.so',
+            'libtesseract.so': 'libtess.so',
+        }
         for n in a.namelist():
             if n.startswith('jni/') and n.endswith('.so'):
-                z.writestr('lib/' + n[4:], a.read(n))
+                data = a.read(n)
+                z.writestr('lib/' + n[4:], data)
+                base = n.rsplit('/', 1)[-1]
+                if base in alias:
+                    z.writestr('lib/' + n[4:].rsplit('/', 1)[0] + '/' + alias[base], data)
```

### 3.2 `android/app/src/main/java/com/qinghe/ledger/OcrEngine.java`

```diff
     public static synchronized String recognize(Context context, Bitmap bitmap) throws Exception {
+        if (bitmap == null || bitmap.isRecycled()
+                || bitmap.getWidth() <= 0 || bitmap.getHeight() <= 0) {
+            throw new IllegalArgumentException("bitmap invalid");
+        }
         ensureInit(context);
         long started = SystemClock.elapsedRealtime();
+        Log.i(TAG, "input bitmap=" + bitmap.getWidth() + "x" + bitmap.getHeight()
+                + " config=" + bitmap.getConfig());
         api.setImage(bitmap);
@@
     private static void ensureInit(Context context) throws Exception {
         if (api != null) return;
         long started = SystemClock.elapsedRealtime();
         File root = new File(context.getFilesDir(), "tesseract");
         File data = new File(root, "tessdata/" + LANG + ".traineddata");
-        int rev = context.getSharedPreferences("qinghe_ocr", 0).getInt("model_rev", 0);
-        if (!data.exists() || rev != MODEL_REV) {
+        int rev = context.getSharedPreferences("qinghe_ocr", 0).getInt("model_rev", 0);
+        Log.i(TAG, "init root=" + root.getAbsolutePath()
+                + " model=" + data.getAbsolutePath()
+                + " exists=" + data.exists()
+                + " size=" + (data.exists() ? data.length() : 0)
+                + " rev=" + rev + "/" + MODEL_REV);
+        if (!data.exists() || data.length() < 1024 || rev != MODEL_REV) {
             copyModel(context, data);
             context.getSharedPreferences("qinghe_ocr", 0).edit().putInt("model_rev", MODEL_REV).apply();
         }
-        TessBaseAPI engine = new TessBaseAPI();
-        if (!engine.init(root.getAbsolutePath(), LANG)) {
-            engine.end();
-            if (data.delete()) copyModel(context, data);
-            engine = new TessBaseAPI();
-            if (!engine.init(root.getAbsolutePath(), LANG)) {
-                engine.end();
-                throw new IllegalStateException("OCR 模型初始化失败，请重装备份后重试");
-            }
-        }
-        engine.setPageSegMode(TessBaseAPI.PageSegMode.PSM_SINGLE_BLOCK);
-        engine.setDebug(false);
-        api = engine;
+        try {
+            api = initOnce(root);
+        } catch (Throwable first) {
+            Log.e(TAG, "OCR init failed, retry after re-copy model", first);
+            data.delete();
+            try {
+                copyModel(context, data);
+                api = initOnce(root);
+            } catch (Throwable second) {
+                Log.e(TAG, "OCR init retry failed", second);
+                throw new IllegalStateException("OCR 引擎初始化失败", second);
+            }
+        }
         Log.i(TAG, "OCR engine ready, version=" + api.getVersion()
                 + ", cost=" + (SystemClock.elapsedRealtime() - started) + "ms");
     }
+
+    private static TessBaseAPI initOnce(File root) throws Exception {
+        TessBaseAPI engine = new TessBaseAPI();
+        boolean ok;
+        try {
+            ok = engine.init(root.getAbsolutePath(), LANG);
+        } catch (Throwable e) {
+            engine.end();
+            if (e instanceof Exception) throw (Exception) e;
+            throw new RuntimeException(e);
+        }
+        Log.i(TAG, "TessBaseAPI.init(" + root.getAbsolutePath() + "," + LANG + ")=" + ok);
+        if (!ok) {
+            engine.end();
+            throw new IllegalStateException("TessBaseAPI.init returned false");
+        }
+        engine.setPageSegMode(TessBaseAPI.PageSegMode.PSM_SINGLE_BLOCK);
+        engine.setDebug(false);
+        return engine;
+    }
```

`copyModel()` 末尾增加：

```java
Log.i(TAG, "model copied: " + data.getAbsolutePath() + " size=" + data.length());
```

### 3.3 `android/app/src/main/java/com/qinghe/ledger/GalleryOcrService.java`

```diff
     private void process() {
         Bitmap bmp = null;
+        Bitmap crop = null;
         try {
@@
             if (bmp == null) {
                 fail("没有找到刚才的截图。请先在支付页截屏，再点磁贴");
                 return;
             }
+            if (bmp.isRecycled() || bmp.getWidth() <= 0 || bmp.getHeight() <= 0) {
+                fail("截图读取失败，请重试");
+                return;
+            }
             int cropH = Math.max(1, (int) (bmp.getHeight() * 0.55f));
-            Bitmap crop = Bitmap.createBitmap(bmp, 0, 0, bmp.getWidth(), cropH);
+            crop = Bitmap.createBitmap(bmp, 0, 0, bmp.getWidth(), cropH);
@@
         } catch (Throwable e) {
-            Log.e(TAG, "process failed", e);
-            String msg = e.getMessage();
-            fail("识别失败：" + (msg == null || msg.isEmpty() ? e.getClass().getSimpleName() : msg));
+            // 技术类名只写日志，用户侧统一友好提示
+            Log.e(TAG, "process failed: " + e.getClass().getName(), e);
+            fail("识别失败：文字识别异常，请重试");
         } finally {
+            if (crop != null && crop != bmp && !crop.isRecycled()) crop.recycle();
             if (bmp != null && !bmp.isRecycled()) bmp.recycle();
         }
```

## 4. 3 条测试验证步骤

1. **正常识别**：微信支付成功页截屏 → 下拉状态栏点「记账识别」→ 应弹出确认卡（金额/商户/时间），日志 `QHOCR` 中能看到 `TessBaseAPI.init(...)=true`，不再出现 `TessBaseAPI` 类名。
2. **连续触发**：连续点 3 次磁贴，`QHGalleryOCR` 不应出现并发初始化异常；每次都要么弹卡、要么给友好提示，不能卡死。
3. **训练包缺失**：清除应用数据后，把 `assets/tessdata/chi_sim.traineddata` 改名重打包（或删除私有目录模型），再次识别；应自动从 assets 重拷并恢复，若仍失败只显示“识别失败：文字识别异常，请重试”。

> 说明：本机没有 Android 真机/模拟器，以上为代码级与 APK 结构验证；APK 已确认包含 4 个 ABI 的 `libtess/liblept/libjpgt/libpngt`，且 `TessBaseAPI` 静态块的加载名与包内文件名一致。
