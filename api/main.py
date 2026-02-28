"""Long2Text API - Long screenshot OCR with format preservation."""

import os
import uuid
import shutil
import time
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import aiofiles

from image_splitter import split_image, detect_image_regions
from ocr_engine import ocr_segment, merge_ocr_results, format_as_markdown

app = FastAPI(title="Long2Text API", version="1.0.0")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://long2text.com",
        "https://www.long2text.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "/tmp/long2text/uploads"
SEGMENTS_DIR = "/tmp/long2text/segments"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(SEGMENTS_DIR, exist_ok=True)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/ocr")
async def process_image(
    file: UploadFile = File(...),
    lang: str = Form(default="ch"),
    scene: str = Form(default="general"),
):
    """Process a long screenshot and return structured text.

    Args:
        file: Image file (PNG, JPG, WEBP)
        lang: Language code - 'ch' for Chinese, 'en' for English
        scene: Scene type - 'general', 'chat', 'meeting', 'article'

    Returns:
        JSON with full text, preview (first 20%), and metadata.
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are accepted")

    job_id = str(uuid.uuid4())[:12]
    job_upload_dir = os.path.join(UPLOAD_DIR, job_id)
    job_segments_dir = os.path.join(SEGMENTS_DIR, job_id)
    os.makedirs(job_upload_dir, exist_ok=True)
    os.makedirs(job_segments_dir, exist_ok=True)

    try:
        # Save uploaded file
        ext = os.path.splitext(file.filename or "image.png")[1] or ".png"
        file_path = os.path.join(job_upload_dir, f"input{ext}")
        async with aiofiles.open(file_path, "wb") as f:
            content = await file.read()
            await f.write(content)

        start_time = time.time()

        # Step 1: Split image
        segments = split_image(file_path, job_segments_dir)

        # Step 2: OCR each segment
        all_ocr_results = []
        total_chars = 0
        for seg in segments:
            blocks = ocr_segment(seg["path"], lang=lang)
            all_ocr_results.append(blocks)
            total_chars += sum(len(b["text"]) for b in blocks)

        # Step 3: Merge results
        raw_text = merge_ocr_results(all_ocr_results, segments)

        # Step 4: Format as markdown
        formatted = format_as_markdown(raw_text, scene=scene)

        processing_time = time.time() - start_time

        # Generate preview (first ~20% of content)
        lines = formatted.split("\n")
        preview_line_count = max(3, len(lines) // 5)
        preview = "\n".join(lines[:preview_line_count])
        if len(lines) > preview_line_count:
            preview += "\n\n..."

        return JSONResponse({
            "job_id": job_id,
            "success": True,
            "result": {
                "full_text": formatted,
                "preview": preview,
                "total_chars": len(formatted),
                "total_lines": len(lines),
                "segments_processed": len(segments),
                "scene": scene,
                "lang": lang,
            },
            "meta": {
                "processing_time_seconds": round(processing_time, 2),
            },
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Cleanup
        shutil.rmtree(job_upload_dir, ignore_errors=True)
        shutil.rmtree(job_segments_dir, ignore_errors=True)


@app.post("/api/ocr/preview")
async def preview_image(
    file: UploadFile = File(...),
    lang: str = Form(default="ch"),
    scene: str = Form(default="general"),
):
    """Quick preview - process only first 2 segments for free tier."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are accepted")

    job_id = str(uuid.uuid4())[:12]
    job_upload_dir = os.path.join(UPLOAD_DIR, job_id)
    job_segments_dir = os.path.join(SEGMENTS_DIR, job_id)
    os.makedirs(job_upload_dir, exist_ok=True)
    os.makedirs(job_segments_dir, exist_ok=True)

    try:
        ext = os.path.splitext(file.filename or "image.png")[1] or ".png"
        file_path = os.path.join(job_upload_dir, f"input{ext}")
        async with aiofiles.open(file_path, "wb") as f:
            content = await file.read()
            await f.write(content)

        segments = split_image(file_path, job_segments_dir)
        total_segments = len(segments)

        # Only process first 2 segments for preview
        preview_segments = segments[:2]
        all_ocr_results = []
        for seg in preview_segments:
            blocks = ocr_segment(seg["path"], lang=lang)
            all_ocr_results.append(blocks)

        raw_text = merge_ocr_results(all_ocr_results, preview_segments)
        formatted = format_as_markdown(raw_text, scene=scene)

        return JSONResponse({
            "job_id": job_id,
            "success": True,
            "preview": formatted,
            "total_segments": total_segments,
            "processed_segments": len(preview_segments),
            "is_preview": True,
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(job_upload_dir, ignore_errors=True)
        shutil.rmtree(job_segments_dir, ignore_errors=True)
