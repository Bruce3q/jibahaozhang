#!/usr/bin/env bash
# 构建记把好账 APK（不使用 Gradle）：aapt2 → javac → d8 → zipalign → apksigner
# 版本号自动取自 android/app/src/main/AndroidManifest.xml，产物为 dist/记把好账-v<版本>.apk
#
# 依赖：JDK 17、Android SDK build-tools 34.0.0 + platform android-34。
# 可用环境变量覆盖：
#   JAVA_HOME           JDK 17 根目录（默认 D:/tmp/qh-android/jdk17）
#   ANDROID_SDK_ROOT    SDK 根目录（默认 D:/tmp/qh-android/sdk）
#   QH_KEYSTORE         签名证书路径（默认 android-build/out/qinghe.keystore）
set -euo pipefail
cd "$(dirname "$0")/.."
# Git Bash 下 $PWD 是 /d/xxx 形式，Windows 原生工具（aapt2/javac/d8）不认识，这里取盘符形式
ROOT="$(pwd -W 2>/dev/null || pwd)"

MANIFEST="$ROOT/android/app/src/main/AndroidManifest.xml"
VERSION=$(sed -n 's/.*android:versionName="\([^"]*\)".*/\1/p' "$MANIFEST" | head -1)
CODE=$(sed -n 's/.*android:versionCode="\([0-9]*\)".*/\1/p' "$MANIFEST" | head -1)
[ -n "$VERSION" ] && [ -n "$CODE" ] || { echo "无法从清单读取版本号" >&2; exit 1; }

SDK="${ANDROID_SDK_ROOT:-D:/tmp/qh-android/sdk}"
BT="$SDK/build-tools/34.0.0"
AJ="$SDK/platforms/android-34/android.jar"
JAVA_HOME="${JAVA_HOME:-D:/tmp/qh-android/jdk17}"
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"

OUT="$ROOT/android-build/out/v$CODE"
KS="${QH_KEYSTORE:-$ROOT/android-build/out/qinghe.keystore}"
APK="$ROOT/dist/记把好账-v$VERSION.apk"

for f in "$BT/aapt2.exe" "$BT/d8.bat" "$BT/zipalign.exe" "$BT/apksigner.bat" "$AJ" "$JAVA_HOME/bin/javac.exe"; do
  [ -e "$f" ] || { echo "缺少构建依赖：$f" >&2; exit 1; }
done
[ -d "$ROOT/android/app/src/main/assets" ] || { echo "缺少 android/app/src/main/assets（先跑 tools/build_single.py 并同步）" >&2; exit 1; }

echo "构建 v$VERSION（versionCode $CODE）"
rm -rf "$OUT"
mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/dex" "$ROOT/dist"

# 1. 编译资源
"$BT/aapt2.exe" compile --dir "$ROOT/android/app/src/main/res" -o "$OUT/res.zip"
# 2. 链接资源 + 打包 assets（-A 会把 WebView 用的 index.html 塞进 assets）
"$BT/aapt2.exe" link -o "$OUT/unsigned.apk" \
  -I "$AJ" \
  --manifest "$MANIFEST" \
  -R "$OUT/res.zip" \
  --java "$OUT/gen" \
  -A "$ROOT/android/app/src/main/assets" \
  --auto-add-overlay

# 3. 编译 Java
find android/app/src/main/java -name '*.java' > "$OUT/sources.txt"
find "$OUT/gen" -name 'R.java' >> "$OUT/sources.txt"
"$JAVA_HOME/bin/javac.exe" -encoding UTF-8 -source 8 -target 8 -nowarn \
  -bootclasspath "$AJ" -classpath "$AJ" \
  -d "$OUT/classes" @"$OUT/sources.txt"

# 4. 转 dex
find "$OUT/classes" -name '*.class' > "$OUT/classes.txt"
"$BT/d8.bat" --min-api 26 --lib "$AJ" --output "$OUT/dex" @"$OUT/classes.txt"

# 5. 把 classes.dex 塞回 APK（aapt2 不负责这一步）
python - "$OUT/unsigned.apk" "$OUT/withdex.apk" "$OUT/dex/classes.dex" <<'PY'
import sys, zipfile, shutil
src, dst, dex = sys.argv[1:4]
shutil.copyfile(src, dst)
with zipfile.ZipFile(dst, 'a', zipfile.ZIP_DEFLATED) as out:
    out.write(dex, 'classes.dex')
PY

# 6. 对齐 + 签名
"$BT/zipalign.exe" -f 4 "$OUT/withdex.apk" "$OUT/aligned.apk"

if [ ! -f "$KS" ]; then
  echo "首次构建，生成签名证书：$KS"
  mkdir -p "$(dirname "$KS")"
  "$JAVA_HOME/bin/keytool.exe" -genkeypair \
    -keystore "$KS" -alias qinghe -keyalg RSA -keysize 2048 -validity 10950 \
    -storepass qinghe123 -keypass qinghe123 \
    -dname "CN=Qinghe Ledger, OU=Dev, O=Qinghe, L=Beijing, ST=Beijing, C=CN"
  echo "请备份该证书：后续版本必须用同一证书签名才能覆盖安装。"
fi

"$BT/apksigner.bat" sign --ks "$KS" \
  --ks-pass pass:qinghe123 --key-pass pass:qinghe123 --ks-key-alias qinghe \
  --out "$APK" "$OUT/aligned.apk"

"$BT/zipalign.exe" -c -v 4 "$APK" | tail -1
"$BT/apksigner.bat" verify --print-certs "$APK" | head -2
ls -lh "$APK"
echo "APK: $APK"
