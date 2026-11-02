# -*- coding: utf-8 -*-
"""从 assets/icon-512.png 生成 Android 各密度启动图标。"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "icon-512.png"
RES = ROOT / "android" / "app" / "src" / "main" / "res"
SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    for folder, size in SIZES.items():
        out = RES / folder
        out.mkdir(parents=True, exist_ok=True)
        src.resize((size, size), Image.LANCZOS).save(out / "ic_launcher.png", optimize=True)
        print("icon", out / "ic_launcher.png", size)


if __name__ == "__main__":
    main()
