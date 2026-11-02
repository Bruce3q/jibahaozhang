# -*- coding: utf-8 -*-
"""用用户提供的品牌图生成 Web/PWA/Android 图标。

源图：assets/brand-source.jpg（1024×1024，白底圆角脚掌）
输出：assets/icon-512.png / icon-192.png / icon-180.png / icon-maskable-512.png
      android/app/src/main/res/mipmap-*/ic_launcher.png
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "brand-source.jpg"
ASSETS = ROOT / "assets"
RES = ROOT / "android" / "app" / "src" / "main" / "res"

SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def square(src: Image.Image, size: int) -> Image.Image:
    return src.resize((size, size), Image.LANCZOS)


def maskable(src: Image.Image, size: int) -> Image.Image:
    """Maskable 图标：保留白底，内容缩到 78% 安全区，避免被系统裁切。"""
    canvas = Image.new("RGB", (size, size), (247, 247, 247))
    inner = int(size * 0.78)
    art = src.resize((inner, inner), Image.LANCZOS)
    canvas.paste(art, ((size - inner) // 2, (size - inner) // 2))
    return canvas


def main() -> None:
    src = Image.open(SRC).convert("RGB")
    if src.width != src.height:
        side = min(src.size)
        left = (src.width - side) // 2
        top = (src.height - side) // 2
        src = src.crop((left, top, left + side, top + side))

    for name, size in (("icon-512.png", 512), ("icon-192.png", 192), ("icon-180.png", 180)):
        out = ASSETS / name
        square(src, size).save(out, "PNG", optimize=True)
        print("web", out, out.stat().st_size)

    maskable(src, 512).save(ASSETS / "icon-maskable-512.png", "PNG", optimize=True)
    print("maskable", ASSETS / "icon-maskable-512.png")

    for folder, size in SIZES.items():
        out = RES / folder
        out.mkdir(parents=True, exist_ok=True)
        # 小尺寸加一点圆角，尽量保持源图的柔和观感
        img = square(src, size).convert("RGBA")
        radius = max(4, int(size * 0.22))
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
        img.putalpha(mask)
        img.save(out / "ic_launcher.png", "PNG", optimize=True)
        print("android", out / "ic_launcher.png", size)


if __name__ == "__main__":
    main()
