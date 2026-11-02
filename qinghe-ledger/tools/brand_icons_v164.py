# -*- coding: utf-8 -*-
"""生成「记把好账」桌面图标：奶油底 + 墨绿日历/账本字形。
只替换图标位图，不改动其他资源。"""
from PIL import Image, ImageDraw
import numpy as np, os

SRC = 'assets/brand-source-v164.jpg'
BIG = 4  # 4 倍超采样后缩放，边缘更干净

def load_glyph():
    im = Image.open(SRC).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    lum = a.mean(axis=2)
    alpha = np.clip((185.0 - lum) / 55.0, 0.0, 1.0)
    m = alpha > 0.06
    ys, xs = np.where(m)
    pad = 8
    x0, x1 = max(0, xs.min()-pad), min(im.width, xs.max()+pad)
    y0, y1 = max(0, ys.min()-pad), min(im.height, ys.max()+pad)
    alpha = alpha[y0:y1, x0:x1]
    h, w = alpha.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., 0] = 1
    rgba[..., 1] = 80
    rgba[..., 2] = 84
    rgba[..., 3] = np.round(alpha * 255).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')

def rounded(size, glyph_frac, radius_frac=0.23, bg=(253, 251, 238), square=False):
    S = size * BIG
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if square:
        d.rectangle([0, 0, S-1, S-1], fill=bg + (255,))
    else:
        d.rounded_rectangle([0, 0, S-1, S-1], radius=int(S*radius_frac), fill=bg + (255,))
    gw = int(S * glyph_frac)
    gh = max(1, int(gw * GLYPH.height / GLYPH.width))
    g = GLYPH.resize((gw, gh), Image.LANCZOS)
    img.alpha_composite(g, ((S-gw)//2, (S-gh)//2))
    return img.resize((size, size), Image.LANCZOS)

GLYPH = load_glyph()
print('glyph', GLYPH.size)

OUT = [
    ('android/app/src/main/res/mipmap-mdpi/ic_launcher.png', 48, 0.58, False),
    ('android/app/src/main/res/mipmap-hdpi/ic_launcher.png', 72, 0.58, False),
    ('android/app/src/main/res/mipmap-xhdpi/ic_launcher.png', 96, 0.58, False),
    ('android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png', 144, 0.58, False),
    ('android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', 192, 0.58, False),
    ('assets/icon-192.png', 192, 0.58, False),
    ('assets/icon-512.png', 512, 0.58, False),
    ('assets/icon-180.png', 180, 0.56, True),          # iOS 不吃透明，铺满
    ('assets/icon-maskable-512.png', 512, 0.46, True),  # 安全区 80% 内
]
for path, size, frac, square in OUT:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    rounded(size, frac, square=square).save(path)
    print('wrote', path, size)

# 预览：白底与浅灰底各放一个，检查边距与居中
prev = Image.new('RGB', (1200, 620), (243, 247, 242))
big = rounded(512, 0.58)
prev.paste(big, (90, 54), big)
sq = rounded(512, 0.58, square=True)
prev.paste(sq, (640, 54), sq)
d = ImageDraw.Draw(prev)
d.text((90, 590), 'rounded / iOS square 512', fill=(60, 80, 70))
prev.save('shots/icon-preview.png')
print('preview saved')
