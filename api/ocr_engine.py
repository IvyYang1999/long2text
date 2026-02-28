"""OCR engine using PaddleOCR for text extraction."""

from paddleocr import PaddleOCR
from typing import List, Tuple
import os

# Initialize PaddleOCR (lazy loading)
_ocr_instances = {}


def get_ocr(lang: str = "ch") -> PaddleOCR:
    """Get or create PaddleOCR instance for given language."""
    if lang not in _ocr_instances:
        _ocr_instances[lang] = PaddleOCR(
            use_angle_cls=True,
            lang=lang,
            show_log=False,
            use_gpu=False,
        )
    return _ocr_instances[lang]


def ocr_segment(image_path: str, lang: str = "ch") -> List[dict]:
    """Run OCR on a single image segment.

    Returns list of detected text blocks with position and content.
    """
    ocr = get_ocr(lang)
    result = ocr.ocr(image_path, cls=True)

    blocks = []
    if result and result[0]:
        for line in result[0]:
            box = line[0]  # [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
            text = line[1][0]
            confidence = line[1][1]

            # Calculate bounding box
            y_min = min(p[1] for p in box)
            y_max = max(p[1] for p in box)
            x_min = min(p[0] for p in box)
            x_max = max(p[0] for p in box)

            blocks.append({
                "text": text,
                "confidence": confidence,
                "bbox": {
                    "x_min": x_min,
                    "y_min": y_min,
                    "x_max": x_max,
                    "y_max": y_max,
                },
            })

    # Sort by y position (top to bottom), then x (left to right)
    blocks.sort(key=lambda b: (b["bbox"]["y_min"], b["bbox"]["x_min"]))
    return blocks


def merge_ocr_results(
    all_segments: List[dict],
    segment_meta: List[dict],
    overlap: int = 200,
) -> str:
    """Merge OCR results from overlapping segments, removing duplicates.

    Args:
        all_segments: List of OCR results per segment (from ocr_segment)
        segment_meta: List of segment metadata (from split_image)
        overlap: Overlap in pixels between segments

    Returns:
        Merged text as markdown string.
    """
    if not all_segments:
        return ""

    if len(all_segments) == 1:
        return "\n".join(b["text"] for b in all_segments[0])

    lines = []
    prev_texts = set()

    for seg_idx, (blocks, meta) in enumerate(zip(all_segments, segment_meta)):
        seg_height = meta["y_end"] - meta["y_start"]

        for block in blocks:
            # For non-first segments, skip blocks in the overlap zone
            # that were already captured by the previous segment
            if seg_idx > 0 and block["bbox"]["y_min"] < overlap * 0.8:
                # Check if this text was already seen
                text_key = block["text"].strip()
                if text_key in prev_texts:
                    continue

            lines.append(block["text"])

        # Track texts from the bottom overlap zone for dedup
        prev_texts.clear()
        for block in blocks:
            if block["bbox"]["y_max"] > seg_height - overlap:
                prev_texts.add(block["text"].strip())

    return "\n".join(lines)


def format_as_markdown(raw_text: str, scene: str = "general") -> str:
    """Format raw OCR text as structured markdown based on scene type.

    Args:
        raw_text: Raw merged OCR text
        scene: One of 'chat', 'article', 'meeting', 'general'

    Returns:
        Formatted markdown string.
    """
    lines = raw_text.split("\n")

    if scene == "chat":
        return _format_chat(lines)
    elif scene == "meeting":
        return _format_meeting(lines)
    elif scene == "article":
        return _format_article(lines)
    else:
        return raw_text


def _format_chat(lines: List[str]) -> str:
    """Format chat-style OCR output."""
    result = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        result.append(line)
    return "\n\n".join(result)


def _format_meeting(lines: List[str]) -> str:
    """Format meeting transcript OCR output."""
    result = ["# Meeting Transcript\n"]
    for line in lines:
        line = line.strip()
        if not line:
            continue
        result.append(line)
    return "\n\n".join(result)


def _format_article(lines: List[str]) -> str:
    """Format article OCR output with paragraph detection."""
    result = []
    current_para = []

    for line in lines:
        line = line.strip()
        if not line:
            if current_para:
                result.append(" ".join(current_para))
                current_para = []
            continue
        current_para.append(line)

    if current_para:
        result.append(" ".join(current_para))

    return "\n\n".join(result)
