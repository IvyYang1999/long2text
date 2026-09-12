import { NextRequest, NextResponse } from "next/server";
import { ocrImage } from "@/lib/tencent-ocr";
import sharp from "sharp";
import { googleOcrImage, GoogleOcrError } from "@/lib/google-ocr";
import { configuredOcrProvider, OCR_MAX_BYTES, GOOGLE_MAX_PIXELS } from "@/lib/ocr-config";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    return NextResponse.json({ provider: configuredOcrProvider() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ detail: "OCR is not configured" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const provider = configuredOcrProvider();
    const formData = await request.formData();
    const file = formData.get("file");
    const requestedProvider = formData.get("provider");
    if (requestedProvider && requestedProvider !== provider) {
      return NextResponse.json({ success: false, detail: "OCR configuration changed. Please upload again" }, { status: 409 });
    }

    if (!(file instanceof File) || !file.type.startsWith("image/") || file.size === 0) {
      return NextResponse.json(
        { success: false, detail: "Please upload an image file" },
        { status: 400 },
      );
    }
    if (file.size > OCR_MAX_BYTES) {
      return NextResponse.json({ success: false, detail: "Image part is too large" }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();
    let imageBuffer: Buffer = Buffer.from(arrayBuffer);
    let blocks;
    if (provider === "google") {
      const input = sharp(imageBuffer, { limitInputPixels: GOOGLE_MAX_PIXELS });
      const meta = await input.metadata().catch(() => null);
      if (!meta?.width || !meta.height || (meta.pages ?? 1) !== 1 ||
          meta.width * meta.height > GOOGLE_MAX_PIXELS || !["jpeg", "png", "webp"].includes(meta.format ?? "")) {
        return NextResponse.json({ success: false, detail: "Unsupported image. Please use a JPG, PNG or WebP screenshot" }, { status: 400 });
      }
      const swapped = (meta.orientation ?? 1) >= 5;
      const width = swapped ? meta.height : meta.width, height = swapped ? meta.width : meta.height;
      if (meta.orientation && meta.orientation !== 1) imageBuffer = await input.rotate().jpeg({ quality: 92 }).toBuffer();
      if (imageBuffer.length > OCR_MAX_BYTES) return NextResponse.json({ success: false, detail: "Image part is too large" }, { status: 413 });
      blocks = await googleOcrImage(imageBuffer, width, height);
    } else {
      blocks = await ocrImage(imageBuffer);
    }
    const text = blocks.map((b) => b.text).join("\n");

    return NextResponse.json({
      success: true,
      text,
      blocks,
      chars: text.length,
      provider,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const errMsg = err instanceof GoogleOcrError ? err.message : "OCR processing failed. Please try again";
    return NextResponse.json(
      {
        success: false,
        detail: errMsg,
      },
      { status: err instanceof GoogleOcrError ? err.status : 500 },
    );
  }
}
