"""Dial texture for the 3D watch (ZITO 1950 Esploratore GMT, slate-blue sunburst).

Printed elements only: sunburst, black 24-hour flange, minute track, logo, text and the date
showing through the window. Indices, hands and the date frame are geometry in Blender.

Layout measured on 3d_watch_referencess/24.jpg (11.8 px/mm). Texture radius R = 19.3 mm
(bezel opening); centre = dial centre, 12 o'clock at the top.

Run from zito1950/: python scripts/watch3d/dial_texture.py   (needs Pillow, numpy)
Writes scripts/watch3d/build/dial.png (2048 px).
"""

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

S = 2048
C = S / 2
R_MM = 19.3
OUT = Path(__file__).parent / 'build'
FONTS = Path('C:/Windows/Fonts')

R_FLANGE_IN = 16.5 / R_MM  # inner edge of the black 24 h flange
R_TRACK = (15.75 / R_MM, 16.35 / R_MM)  # minute ticks, just inside the flange
R_NUMERALS = 17.9 / R_MM
DATE_X, DATE_W, DATE_H = 11.9 / R_MM, 6.1 / R_MM, 4.0 / R_MM

WHITE = (226, 229, 224)
RED = (206, 36, 32)


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    for candidate in name.split('|'):
        path = FONTS / candidate
        if path.exists():
            return ImageFont.truetype(str(path), size)
    raise FileNotFoundError(name)


def px(f: float) -> float:
    return f * C


def sunburst() -> Image.Image:
    """Slate blue (hue ~216°, measured on all 24 references), lighter towards the centre, diagonal sheen, radial brushing."""
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    dx, dy = (xx - C) / C, (yy - C) / C
    r = np.hypot(dx, dy)
    a = np.arctan2(dy, dx)
    rng = np.random.default_rng(1950)
    streaks = rng.normal(0, 1, 4096).astype(np.float32)
    streaks = np.convolve(np.tile(streaks, 3), np.ones(3) / 3, 'same')[4096:8192]
    brush = streaks[((a + math.pi) / math.tau * 4096).astype(int) % 4096]
    sheen = 0.5 + 0.5 * np.cos(2 * (a + 0.75))
    k = np.clip(1 - (r / R_FLANGE_IN) ** 1.5, 0, 1) * (0.45 + 0.55 * sheen) + 0.025 * brush
    rgb = np.stack([30 + 50 * k, 42 + 58 * k, 60 + 70 * k], -1)
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))


def text(im, xy, s, f, fill):
    ImageDraw.Draw(im).text(xy, s, font=f, fill=fill, anchor='mm')


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    im = Image.new('RGB', (S, S), (15, 17, 18))
    inner = Image.new('L', (S, S), 0)
    ImageDraw.Draw(inner).ellipse([C - px(R_FLANGE_IN), C - px(R_FLANGE_IN), C + px(R_FLANGE_IN), C + px(R_FLANGE_IN)], fill=255)
    im.paste(sunburst(), (0, 0), inner)
    d = ImageDraw.Draw(im)

    # 24 h flange: numerals with their tops facing out (bottom ones read upside down, as on the watch), dots between.
    num = font('arial.ttf', 60)
    for h in range(1, 25):
        a = math.radians(h * 15 - 90)
        x, y = C + px(R_NUMERALS) * math.cos(a), C + px(R_NUMERALS) * math.sin(a)
        layer = Image.new('RGBA', (180, 120), (0, 0, 0, 0))
        ImageDraw.Draw(layer).text((90, 60), str(h), font=num, fill=WHITE, anchor='mm')
        layer = layer.rotate(-h * 15, resample=Image.BICUBIC)
        im.paste(layer, (int(x - 90), int(y - 60)), layer)
        a2 = math.radians(h * 15 + 7.5 - 90)
        cx, cy = C + px(R_NUMERALS) * math.cos(a2), C + px(R_NUMERALS) * math.sin(a2)
        d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=WHITE)

    # Minute track: fine ticks, none where an index sits.
    for m in range(60):
        if m % 5 == 0:
            continue
        a = math.radians(m * 6 - 90)
        r0, r1 = px(R_TRACK[0]), px(R_TRACK[1])
        d.line([(C + r0 * math.cos(a), C + r0 * math.sin(a)), (C + r1 * math.cos(a), C + r1 * math.sin(a))], fill=(214, 220, 196), width=5)

    # Printing, positions as a share of R from the centre (negative = towards 12).
    text(im, (C, C - px(0.44)), 'ZITO', font('arialbd.ttf', 170), WHITE)
    text(im, (C, C - px(0.295)), '1950', font('arial.ttf', 122), RED)
    text(im, (C, C + px(0.25)), 'Esploratore', font('segoesc.ttf', 92), RED)
    text(im, (C, C + px(0.355)), 'GMT', font('timesbd.ttf|georgiab.ttf|arialbd.ttf', 92), WHITE)
    text(im, (C, C + px(0.44)), '20 ATM W.R.', font('arial.ttf', 60), WHITE)
    text(im, (C, C + px(0.70)), 'AUTOMATICO', font('arial.ttf', 40), WHITE)

    # Date disc seen through the window, with the window's inner shadow at the top.
    wx0, wx1 = C + px(DATE_X - DATE_W / 2), C + px(DATE_X + DATE_W / 2)
    wy0, wy1 = C - px(DATE_H / 2), C + px(DATE_H / 2)
    d.rectangle([wx0, wy0, wx1, wy1], fill=(248, 248, 244))  # white date wheel (24, 01.jpg)
    for i in range(24):
        shade = int(248 - 60 * (1 - i / 24) ** 2)
        d.line([(wx0, wy0 + i), (wx1, wy0 + i)], fill=(shade, shade, shade - 4))
    # Printed larger than the real date disc: the lens is plain glass in the viewer, so this is the magnified view.
    text(im, ((wx0 + wx1) / 2, (wy0 + wy1) / 2 + 8), '20', font('arialbd.ttf', 250), (22, 22, 22))

    im.filter(ImageFilter.GaussianBlur(0.6)).save(OUT / 'dial.png')


if __name__ == '__main__':
    main()
