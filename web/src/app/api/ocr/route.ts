import { NextRequest, NextResponse } from "next/server";
import { ocrImage } from "@/lib/tencent-ocr";

// Single segment OCR - client splits the image and sends segments one by one
export const maxDuration = 30;

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

    const blocks = await ocrImage(imageBuffer);
    const text = blocks.map((b) => b.text).join("\n");

    return NextResponse.json({
      success: true,
      text,
      blocks,
      chars: text.length,
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
