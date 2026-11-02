# 微信支付页 OCR 超时修复 · v1.3.2

> 症状：微信「支付成功」页停留时点磁贴，提示「识别超时，请停留在支付成功页面再试」。
> 样例页面：`✅ 支付成功 / 安升超市东环店 / ¥1.00 / 摇一摇，有优惠`。

## 1. 根因判断

按可能性从高到低：

1. **OCR 输入图太大，Tesseract 首次识别超时**  
   旧逻辑把 1080×2400 的整屏图缩到 1280 宽，高度仍有约 2844 像素，再用
   `PSM_SINGLE_BLOCK` 做中文识别。中低端机首次加载模型 + 全屏识别很容易超过 25 秒，
   而旧代码 `future.get(25s)` 到点就报超时，用户看到的就是这句提示。

2. **首次模型初始化被算进 25 秒**  
   `chi_sim.traineddata` 约 2.4 MB，第一次复制 + `TessBaseAPI.init()` 需要时间；
   旧代码在点击后才开始初始化，初始化 + 识别共用 25 秒。

3. **整屏文字干扰**  
   截图包含状态栏「屏幕共享防护中」、时间、信号、电量，以及下半屏「摇一摇，有优惠」；
   整屏 OCR 既慢，又容易把广告误当商户。

4. **商户匹配方向与微信布局相反**  
   旧 `findMerchant()` 主要在金额之后找商户，而微信新版是「支付成功 → 商户 → 金额」，
   所以即使 OCR 成功，也可能只拿到金额、拿不到商户。

5. **截图获取超时只有 3 秒**  
   MediaProjection 首帧在部分机型上建立 VirtualDisplay 较慢，3 秒会误判截屏失败。

6. **状态栏干扰**  
   `屏幕共享防护中` 本身不会被当成金额，但会进入 OCR 文本；需要过滤，避免影响商户候选。

## 2. 修改文件清单

| 文件 | 修改 |
| --- | --- |
| `android/.../ScreenOcrService.java` | 截图 8 秒、OCR 90 秒；只裁上半屏；缩放到 1000px；分步日志；区分“超时”与“识别到画面但无支付信息”；启动时预热 OCR |
| `android/.../OcrEngine.java` | 增加模型初始化/识别耗时日志、`warmUp()` |
| `android/.../PayPageParser.java` | 适配「支付成功 → 商户 → ¥金额」；过滤状态栏/广告；金额支持 `¥1.00`、`￥ 1.00`、`1,00`；匹配失败打日志 |
| `android/.../TileStore.java` | 新增可调参数：`capture_timeout_ms`、`ocr_timeout_ms`、`ocr_max_width` |
| `android/.../MainActivity.java` | `QHRecognition.setOcrConfig(captureMs, ocrMs, maxWidth)` 调试桥 |
| `AndroidManifest.xml` | versionCode 8 / versionName 1.3.2 |
| `js/app.js`、`sw.js` | 关于页 v1.3.2；SW v11 |

未改动：磁贴、悬浮窗权限、去重、确认卡组件、入账数据层。

## 3. 核心 diff

### 3.1 超时与裁剪

```diff
- if (!latch.await(3, TimeUnit.SECONDS)) {
+ if (!latch.await(captureTimeout, TimeUnit.MILLISECONDS)) {
...
- future.get(25, TimeUnit.SECONDS)
+ future.get(ocrTimeout, TimeUnit.MILLISECONDS)
```

```java
private static final float OCR_CROP_RATIO = 0.45f;
...
int cropHeight = Math.max(1, Math.round(shot.getHeight() * OCR_CROP_RATIO));
Bitmap cropped = Bitmap.createBitmap(shot, 0, 0, shot.getWidth(), cropHeight);
if (cropped != shot) shot.recycle();
shot = cropped;

Bitmap target = shot;
if (target.getWidth() > maxWidth) {
    float scale = maxWidth / (float) target.getWidth();
    Bitmap scaled = Bitmap.createScaledBitmap(target, maxWidth,
            Math.max(1, Math.round(target.getHeight() * scale)), true);
    target.recycle();
    target = scaled;
    shot = scaled;
}
```

默认值：`captureTimeout=8000ms`、`ocrTimeout=90000ms`、`maxWidth=1000`。  
调试时可在 WebView 控制台执行：

```js
QHRecognition.setOcrConfig(8000, 120000, 1000);
```

### 3.2 启动预热

```java
final Context app = getApplicationContext();
ocr.submit(new Runnable() {
    @Override public void run() { OcrEngine.warmUp(app); }
});
```

### 3.3 日志

```java
Log.i(TAG, "capture start: captureTimeout=... ocrTimeout=... maxWidth=...");
Log.i(TAG, "virtualDisplay created " + width + "x" + height);
Log.i(TAG, "bitmap captured " + w + "x" + h + " in ...ms, meanGray=" + mean);
if (mean < 3) Log.w(TAG, "bitmap looks black/blank ...");
Log.i(TAG, "ocr input " + w + "x" + h + " cropRatio=0.45 prepareCost=...");
Log.i(TAG, "ocr return chars=... cost=...ms");
Log.i(OCR_TAG, "===== raw text begin =====");
// 逐行：01| 支付成功
Log.i(OCR_TAG, "===== raw text end =====");
Log.i(TAG, "matched merchant=... amount=... totalCost=...ms");
```

`adb logcat -s QHTile QHOCR` 可看到完整链路。

### 3.4 商户匹配

```java
// 微信新版：商户在「支付成功」下一行，金额在商户下一行
int successIdx = -1, amountIdx = -1;
for (...) {
    if (successIdx < 0 && SUCCESS_LINE.matcher(line).find()) successIdx = i;
    if (amountIdx < 0 && AMOUNT_LINE.matcher(line).find()) amountIdx = i;
}
for (int i = successIdx + 1; i < (amountIdx > successIdx ? amountIdx : lines.length); i++) {
    String candidate = cleanMerchant(lines[i]);
    if (validMerchant(candidate)) return candidate;
}
```

`validMerchant()` 过滤时间、5G/4G、电量、`屏幕共享防护中`、`摇一摇，有优惠`、纯金额。
`cleanMerchant()` 去掉 `¥` 后的内容和首尾符号。

### 3.5 金额

```java
String s = compact.replaceAll("(?<=\\d)[,，](?=\\d{2}(?!\\d))", ".")
        .replace(",", "").replace("，", "");
Matcher m = Pattern.compile("[¥￥]\\s*([0-9]+(?:\\.[0-9]{1,2})?)").matcher(s);
```

### 3.6 两类失败提示

```java
// OCR 有返回文本，但正则找不到金额/商户
fail("识别到画面，但未找到支付信息");

// 截图超时 / 黑屏 / OCR 超时
fail("识别超时，请停留在支付成功页面再试");
```

## 4. 三条测试步骤

### 测试 1：样例页面直接识别

1. 打开微信支付成功页（`支付成功 / 安升超市东环店 / ¥1.00`）。
2. 点磁贴。
3. 预期：弹出确认卡「¥1.00 / 安升超市东环店 / 购物」。

日志：

```bash
adb logcat -s QHTile QHOCR
# capture start captureTimeout=8000
# bitmap captured 864x1920 ... meanGray=2xx
# ocr input 1000x1000 cropRatio=0.45
# ocr return chars=... cost=...
# 01| 支付成功
# 02| 安升超市东环店
# 03| ¥1.00
# matched merchant=安升超市东环店 amount=1.00
```

### 测试 2：慢设备超时

1. 首装后立刻点磁贴（模型还没预热）。
2. 预期：不出现 25 秒超时；日志显示模型 `warmUp ready` 和 OCR `cost`，90 秒内返回。
3. 若确实超时，调大：

```js
QHRecognition.setOcrConfig(8000, 150000, 1000)
```

### 测试 3：非支付页/黑屏

1. 在微信聊天页点磁贴。
2. 预期：截图和 OCR 正常返回，但提示「识别到画面，但未找到支付信息」，**不是**“识别超时”。
3. 若日志 `meanGray<3`，说明系统对当前页面启用防截屏（或投影黑屏），无法读取，属于系统安全限制。
