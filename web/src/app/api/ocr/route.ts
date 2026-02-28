import { NextRequest, NextResponse } from "next/server";
import { splitImage } from "@/lib/image-splitter";
import { ocrImage, mergeOCRResults, formatAsMarkdown } from "@/lib/tencent-ocr";

// Allow larger payloads for image uploads (20MB)
export const maxDuration = 60; // seconds

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const lang = (formData.get("lang") as string) || "ch";
    const scene = (formData.get("scene") as string) || "general";

    if (!file || !file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, detail: "Please upload an image file" },
        { status: 400 },
      );
    }

    const startTime = Date.now();

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // Step 1: Split image into overlapping segments
    const splitResult = await splitImage(imageBuffer);

    // Step 2: OCR each segment (sequential to respect API rate limits)
    const allOCRResults = [];
    for (const segment of splitResult.segments) {
      const blocks = await ocrImage(segment.buffer);
      allOCRResults.push(blocks);
    }

    // Step 3: Merge and deduplicate
    const rawText = mergeOCRResults(
      allOCRResults,
      splitResult.overlap,
      splitResult.segmentHeight,
    );

    // Step 4: Format as markdown
    const formatted = formatAsMarkdown(rawText, scene);

    const processingTime = (Date.now() - startTime) / 1000;
    const lines = formatted.split("\n");

    // Generate preview (first ~20%)
    const previewLineCount = Math.max(3, Math.floor(lines.length / 5));
    let preview = lines.slice(0, previewLineCount).join("\n");
    if (lines.length > previewLineCount) {
      preview += "\n\n...";
    }

    return NextResponse.json({
      success: true,
      result: {
        full_text: formatted,
        preview,
        total_chars: formatted.length,
        total_lines: lines.length,
        segments_processed: splitResult.segments.length,
        scene,
        lang,
      },
      meta: {
        processing_time_seconds: Math.round(processingTime * 100) / 100,
        image_width: splitResult.width,
        image_height: splitResult.height,
      },
    });
  } catch (err) {
    console.error("OCR error:", err);
    return NextResponse.json(
      {
        success: false,
        detail: err instanceof Error ? err.message : "Processing failed",
      },
      { status: 500 },
    );
  }
}
