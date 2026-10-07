"""Square, uniformly framed catalogue-card photos.

Reads public/img/models/*.jpg and writes public/img/cards/{name}.jpg + .webp:
- photos shot on white: trim the white margin, centre the watch on a white square
  with the same relative padding, so every card frames the product alike;
- full-bleed detail shots (background reaches the edges): centre square crop.
Never upscales: the square side is the trimmed subject's long side plus padding, capped at 640.

Run: python3 scripts/card-crops.py   (from the zito/ folder; needs Pillow)
"""

from pathlib import Path

from PIL import Image, ImageChops

SRC = Path('public/img/models')
OUT = Path('public/img/cards')
MAX = 640
PAD = 0.08  # padding on each side, as a share of the square side
WHITE_LEVEL = 236  # a pixel this light on every channel counts as background


def border_is_white(im: Image.Image) -> bool:
    """True when at least 90% of the 2px frame is near-white (product shot on white)."""
    g = im.convert('L')
    w, h = g.size
    strips = [g.crop((0, 0, w, 2)), g.crop((0, h - 2, w, h)), g.crop((0, 0, 2, h)), g.crop((w - 2, 0, w, h))]
    total = light = 0
    for s in strips:
        hist = s.histogram()
        total += sum(hist)
        light += sum(hist[WHITE_LEVEL:])
    return light / total >= 0.9


def subject_box(im: Image.Image) -> tuple[int, int, int, int]:
    """Bounding box of everything darker than the white background."""
    g = im.convert('L').point(lambda v: 255 if v < WHITE_LEVEL else 0)
    box = g.getbbox()
    return box or (0, 0, *im.size)


def card(im: Image.Image) -> Image.Image:
    im = im.convert('RGB')
    w, h = im.size
    if not border_is_white(im):
        side = min(w, h)
        left, top = (w - side) // 2, (h - side) // 2
        sq = im.crop((left, top, left + side, top + side))
        return sq.resize((MAX, MAX), Image.LANCZOS) if side > MAX else sq
    subject = im.crop(subject_box(im))
    long_side = max(subject.size)
    side = min(MAX, round(long_side / (1 - 2 * PAD)))
    inner = round(side * (1 - 2 * PAD))
    if long_side > inner:
        scale = inner / long_side
        subject = subject.resize((max(1, round(subject.width * scale)), max(1, round(subject.height * scale))), Image.LANCZOS)
    canvas = Image.new('RGB', (side, side), (255, 255, 255))
    canvas.paste(subject, ((side - subject.width) // 2, (side - subject.height) // 2))
    return whiten(canvas)


def whiten(im: Image.Image) -> Image.Image:
    """Pixels near-white on every channel become pure white, so the card blends with the page."""
    mask = im.convert('L').point(lambda v: 255 if v >= WHITE_LEVEL + 8 else 0)
    low_chroma = ImageChops.difference(im.convert('L').convert('RGB'), im).convert('L').point(lambda v: 255 if v < 10 else 0)
    im.paste((255, 255, 255), mask=ImageChops.multiply(mask, low_chroma))
    return im


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for path in sorted(SRC.glob('*.jpg')):
        out = card(Image.open(path))
        out.save(OUT / path.name, quality=84, optimize=True, progressive=True)
        out.save(OUT / path.with_suffix('.webp').name, quality=80, method=6)
        print(f'{path.name}: {out.size[0]}x{out.size[1]}')


if __name__ == '__main__':
    main()
