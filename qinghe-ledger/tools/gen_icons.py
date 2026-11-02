# -*- coding: utf-8 -*-
"""生成辣脚记账的图标（PNG 192/512、maskable 512 与 favicon.svg）。

用法：python tools/gen_icons.py
依赖：Pillow（DSH 运行时内置）。
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
ASSETS.mkdir(exist_ok=True)

S = 512
SS = 4  # 超采样倍数，边缘更平滑


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def vertical_gradient(size, top, bottom):
    img = Image.new("RGB", (1, size), top)
    px = img.load()
    for y in range(size):
        px[0, y] = lerp(top, bottom, y / max(1, size - 1))
    return img.resize((size, size))


def leaf_points(cx, bottom, top, half_w, steps=90):
    """用三次贝塞尔生成一片左右对称的叶子轮廓。"""
    import math

    p0 = (cx, bottom)
    p3 = (cx, top)
    left = [(cx - half_w * 0.35, bottom - (bottom - top) * 0.18),
            (cx - half_w, top + (bottom - top) * 0.42)]
    right = [(cx + half_w, top + (bottom - top) * 0.42),
             (cx + half_w * 0.35, bottom - (bottom - top) * 0.18)]

    def bez(p0, p1, p2, p3, t):
        mt = 1 - t
        return (
            mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0],
            mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1],
        )

    pts = []
    # 左半：从底部到顶部
    for i in range(steps + 1):
        t = i / steps
        pts.append(bez(p0, left[0], left[1], p3, t))
    # 右半：从顶部回到底部
    for i in range(1, steps + 1):
        t = i / steps
        pts.append(bez(p3, right[0], right[1], p0, t))
    return pts


def draw_icon(size, maskable=False):
    n = size * SS
    x = n / S  # 坐标缩放

    base = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    grad = vertical_gradient(n, (99, 180, 126), (56, 130, 82)).convert("RGBA")

    if maskable:
        base.alpha_composite(grad)
    else:
        mask = Image.new("L", (n, n), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, n - 1, n - 1], radius=int(112 * x), fill=255)
        base.paste(grad, (0, 0), mask)

    d = ImageDraw.Draw(base)

    # 柔和的高光：左上角一大一小两团
    glow = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([int(-60 * x), int(-90 * x), int(300 * x), int(240 * x)], fill=(255, 255, 255, 36))
    gd.ellipse([int(280 * x), int(300 * x), int(560 * x), int(580 * x)], fill=(255, 255, 255, 18))
    base.alpha_composite(glow)

    # 叶子（maskable 时整体缩小到安全区内）
    scale = 0.82 if maskable else 1.0
    cx = 256 * x
    bottom = (256 + 132 * scale) * x
    top = (256 - 148 * scale) * x
    half_w = 122 * scale * x

    pts = leaf_points(cx, bottom, top, half_w)
    d.polygon(pts, fill=(247, 251, 244, 255))

    # 叶脉：一条主脉 + 三条侧脉（用浅绿描边，避免纯白太单调）
    vein = (95, 160, 112, 190)
    d.line([(cx, bottom - 22 * x), (cx, top + 26 * x)], fill=vein, width=max(2, int(7 * x)))
    for i, dy in enumerate((0.28, 0.48, 0.68)):
        yy = bottom - (bottom - top) * dy
        spread = half_w * (0.55 - 0.05 * i)
        d.line([(cx, yy + 30 * x), (cx - spread * 0.8, yy - spread * 0.25)],
               fill=vein, width=max(2, int(5 * x)))
        d.line([(cx, yy + 30 * x), (cx + spread * 0.8, yy - spread * 0.25)],
               fill=vein, width=max(2, int(5 * x)))

    # 叶柄
    d.line([(cx, bottom - 6 * x), (cx - 10 * x, bottom + 46 * x)],
           fill=(240, 248, 238, 255), width=max(3, int(13 * x)))

    return base.resize((size, size), Image.LANCZOS)


def main():
    draw_icon(192).save(ASSETS / "icon-192.png", optimize=True)
    draw_icon(512).save(ASSETS / "icon-512.png", optimize=True)
    draw_icon(512, maskable=True).save(ASSETS / "icon-maskable-512.png", optimize=True)
    print("icons written to", ASSETS)


if __name__ == "__main__":
    main()
