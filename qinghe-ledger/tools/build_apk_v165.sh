#!/usr/bin/env bash
# 构建记把好账 APK（不使用 Gradle）：aapt2 → javac → d8 → zipalign → apksigner
# v1.6.5：支出分类新增「水果」「加餐」（记一笔与补记同步）。
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
BT="$ROOT/android-build/sdk/android-14"
AJ="$ROOT/android-build/sdk/android-34/android.jar"
JAVA_HOME="$ROOT/android-build/sdk/jdk-17.0.20.1+1"
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"
OUT="$ROOT/android-build/out/v165"
PY="/c/Users/yls666/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/python.exe"
KS="$ROOT/android-build/out/qinghe.keystore"
rm -rf "$OUT"
mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/dex"

"$BT/aapt2.exe" compile --dir "$ROOT/android/app/src/main/res" -o "$OUT/res.zip"
"$BT/aapt2.exe" link -o "$OUT/unsigned.apk" \
  -I "$AJ" \
  --manifest "$ROOT/android/app/src/main/AndroidManifest.xml" \
  -R "$OUT/res.zip" \
  --java "$OUT/gen" \
  -A "$ROOT/android/app/src/main/assets" \
  --auto-add-overlay

find android/app/src/main/java -name '*.java' > "$OUT/sources.txt"
find android-build/out/v165/gen -name 'R.java' >> "$OUT/sources.txt"
"$JAVA_HOME/bin/javac.exe" -encoding UTF-8 -source 8 -target 8 \
  -bootclasspath "$AJ" -classpath "$AJ" \
  -d "$OUT/classes" @"$OUT/sources.txt"

find android-build/out/v165/classes -name '*.class' > "$OUT/classes.txt"
"$BT/d8.bat" --min-api 26 --lib "$AJ" --output "$OUT/dex" @"$OUT/classes.txt"

"$PY" - "$OUT/unsigned.apk" "$OUT/withdex.apk" "$OUT/dex/classes.dex" <<'PY'
import sys, zipfile, shutil
src, dst, dex = sys.argv[1:4]
shutil.copyfile(src, dst)
with zipfile.ZipFile(dst, 'a', zipfile.ZIP_DEFLATED) as out:
    out.write(dex, 'classes.dex')
PY

"$BT/zipalign.exe" -f 4 "$OUT/withdex.apk" "$OUT/aligned.apk"
"$BT/apksigner.bat" sign --ks "$KS" \
  --ks-pass pass:qinghe123 --key-pass pass:qinghe123 --ks-key-alias qinghe \
  --out "$ROOT/dist/记把好账.apk" "$OUT/aligned.apk"
"$BT/zipalign.exe" -c -v 4 "$ROOT/dist/记把好账.apk" | tail -1
echo "APK: $ROOT/dist/记把好账.apk"