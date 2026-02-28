import { NextRequest, NextResponse } from "next/server";
import { ocrImage } from "@/lib/tencent-ocr";

// Single segment OCR - client splits the image and sends segments one by one
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || !file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, detail: "Please upload an image file" },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    console.log(`[OCR] segment size: ${imageBuffer.length} bytes (${(imageBuffer.length / 1024).toFixed(1)} KB), base64 size: ${(imageBuffer.length * 4 / 3 / 1024).toFixed(1)} KB, type: ${file.type}, name: ${file.name}`);

    const blocks = await ocrImage(imageBuffer);
    const text = blocks.map((b) => b.text).join("\n");

    return NextResponse.json({
      success: true,
      text,
      blocks,
      chars: text.length,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Processing failed";
    console.error(`[OCR] FAILED - error: ${errMsg}`);
    return NextResponse.json(
      {
        success: false,
        detail: errMsg,
      },
      { status: 500 },
    );
  }
}
