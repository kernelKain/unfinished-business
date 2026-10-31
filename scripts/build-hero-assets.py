#!/usr/bin/env python3
"""Build responsive hero assets from the documented master image.

Source/master: assets/source/hero-ghostlight-workshop.webp (1512x648, 21:9).
Outputs are written to public/assets/hero and are the only hero files shipped.

Requires Pillow with WebP support and ffmpeg with libaom-av1 for AVIF.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "source" / "hero-ghostlight-workshop.webp"
OUT = ROOT / "public" / "assets" / "hero"
TEMP = ROOT / ".cache-hero-build"


def render(name: str, image: Image.Image, *, jpeg: bool) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    TEMP.mkdir(parents=True, exist_ok=True)
    webp = OUT / f"{name}.webp"
    avif = OUT / f"{name}.avif"
    png = TEMP / f"{name}.png"

    image.save(webp, "WEBP", quality=82, method=6)
    image.save(png, "PNG", optimize=True)
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(png), "-c:v", "libaom-av1", "-still-picture", "1",
            "-crf", "32", "-b:v", "0", "-cpu-used", "6", str(avif),
        ],
        check=True,
    )
    png.unlink(missing_ok=True)
    outputs = [webp, avif]
    if jpeg:
        output = OUT / f"{name}.jpg"
        image.save(output, "JPEG", quality=84, optimize=True, progressive=True)
        outputs.append(output)
    for path in outputs:
        print(f"{path.relative_to(ROOT)}  {path.stat().st_size / 1024:.1f} KiB")


def main() -> None:
    master = Image.open(SOURCE).convert("RGB")
    if master.size != (1512, 648):
        raise SystemExit(f"Unexpected master size {master.size}; update the crop values deliberately.")

    # Wide 21:9 crops for the hero panel.
    for width in (1920, 1280, 768):
        height = round(width * 9 / 21)
        wide = master.resize((width, height), Image.Resampling.LANCZOS)
        wide = ImageEnhance.Sharpness(wide).enhance(1.04)
        render(f"hero-ghostlight-wide-{width}", wide, jpeg=width <= 1280)

    # Portrait 3:4 crop around the workbench robot for narrow screens.
    crop = master.crop((760, 0, 1246, 648))
    for width in (900, 600):
        height = round(width * 4 / 3)
        portrait = crop.resize((width, height), Image.Resampling.LANCZOS)
        portrait = ImageEnhance.Sharpness(portrait).enhance(1.05)
        render(f"hero-ghostlight-portrait-{width}", portrait, jpeg=False)

    TEMP.rmdir()


if __name__ == "__main__":
    main()
