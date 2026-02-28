"""Split long images into overlapping segments for OCR processing."""

from PIL import Image
from typing import List, Tuple
import os
import uuid


def calculate_segment_height(width: int, height: int) -> int:
    """Calculate optimal segment height based on image dimensions."""
    if width <= 500:
        base = 1500
    elif width <= 1000:
        base = 1200
    elif width <= 1500:
        base = 1000
    else:
        base = 800
    return max(600, min(2000, base))


def split_image(
    image_path: str,
    output_dir: str,
    segment_height: int = 0,
    overlap: int = 200,
) -> List[dict]:
    """Split image into overlapping vertical segments.

    Returns list of segment metadata dicts.
    """
    img = Image.open(image_path)
    width, height = img.size

    if segment_height <= 0:
        segment_height = calculate_segment_height(width, height)

    # No splitting needed for short images
    if height <= segment_height * 1.3:
        out_path = os.path.join(output_dir, "seg_000.png")
        img.save(out_path, "PNG")
        return [{
            "index": 0,
            "y_start": 0,
            "y_end": height,
            "path": out_path,
        }]

    step = segment_height - overlap
    segments = []
    y = 0
    i = 0

    while y < height:
        y_end = min(y + segment_height, height)
        crop = img.crop((0, y, width, y_end))
        out_path = os.path.join(output_dir, f"seg_{i:03d}.png")
        crop.save(out_path, "PNG")
        segments.append({
            "index": i,
            "y_start": y,
            "y_end": y_end,
            "path": out_path,
        })
        y += step
        i += 1

    return segments


def detect_image_regions(image_path: str) -> List[dict]:
    """Detect text vs image regions in a long screenshot.

    Returns list of regions with type ('text' or 'image') and coordinates.
    This is used for mixed content (articles with images).
    """
    img = Image.open(image_path).convert("RGB")
    width, height = img.size

    # Simple heuristic: scan horizontal strips and detect
    # high-variance (image) vs low-variance (text/bg) regions
    import numpy as np
    pixels = np.array(img)

    strip_height = 20
    regions = []
    current_type = None
    region_start = 0

    for y in range(0, height - strip_height, strip_height):
        strip = pixels[y:y + strip_height, :, :]
        variance = np.var(strip)

        # High color variance = likely an image; low = text on background
        is_image = variance > 3000

        strip_type = "image" if is_image else "text"
        if strip_type != current_type:
            if current_type is not None:
                regions.append({
                    "type": current_type,
                    "y_start": region_start,
                    "y_end": y,
                })
            current_type = strip_type
            region_start = y

    # Close last region
    if current_type:
        regions.append({
            "type": current_type,
            "y_start": region_start,
            "y_end": height,
        })

    # Merge small regions (< 40px) into neighbors
    merged = []
    for r in regions:
        if merged and (r["y_end"] - r["y_start"]) < 40:
            merged[-1]["y_end"] = r["y_end"]
        else:
            merged.append(r)

    return merged
