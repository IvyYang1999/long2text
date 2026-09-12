import { splitImageInBrowser, type SplitInfo, type ClientSegment } from "./client-splitter";
import { OCR_MAX_BYTES, GOOGLE_MAX_PIXELS, type OcrProvider } from "./ocr-config";

/** Negotiate at runtime so a provider rollback never requires a client rebuild. */
export async function prepareOcr(file: File): Promise<SplitInfo & { provider: OcrProvider }> {
  const response = await fetch("/api/ocr", { cache: "no-store", signal: AbortSignal.timeout(6_000) });
  // An older deployment has no capabilities GET. Preserve its Tencent protocol.
  if (response.status === 404 || response.status === 405) return { ...await splitImageInBrowser(file), provider: "tencent" };
  if (!response.ok) throw new Error("OCR is temporarily unavailable");
  const { provider } = await response.json();
  if (provider === "tencent") return { ...await splitImageInBrowser(file), provider };
  if (provider !== "google") throw new Error("OCR is not configured");
  return { ...await prepareGoogleImage(file), provider };
}

/** Keep the original bytes when possible. Oversized files are tiled at original
 * resolution, never shrunk to squeeze all their text into one paid request.
 */
export async function prepareGoogleImage(file: File): Promise<SplitInfo> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = bitmap;
    if (file.size <= OCR_MAX_BYTES && width * height <= GOOGLE_MAX_PIXELS &&
        ["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return { width, height, segmentHeight: height, overlap: 0,
        segments: [{ index: 0, yStart: 0, yEnd: height, blob: file }] };
    }
    if (width > 16_384) throw new Error("Screenshot is too wide. Please crop it first");
    const segments: ClientSegment[] = [];
    const maxHeight = Math.min(16_384, Math.floor(GOOGLE_MAX_PIXELS / width));
    let y = 0;
    while (y < height) {
      if (segments.length >= 256) throw new Error("Screenshot is too large. Please split it first");
      let h = Math.min(maxHeight, height - y);
      let blob: Blob;
      while (true) {
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Unable to prepare screenshot");
        ctx.fillStyle = "white"; ctx.fillRect(0, 0, width, h);
        ctx.drawImage(bitmap, 0, y, width, h, 0, 0, width, h);
        blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
          b => b ? resolve(b) : reject(new Error("Unable to prepare screenshot")), "image/jpeg", .92));
        canvas.width = canvas.height = 0;
        if (blob.size <= OCR_MAX_BYTES) break;
        if (h <= 256) throw new Error("Screenshot is too dense. Please crop it first");
        h = Math.max(256, Math.floor(h / 2));
      }
      segments.push({ index: segments.length, yStart: y, yEnd: y + h, blob });
      if (y + h >= height) break;
      y += h - Math.min(200, Math.floor(h / 4));
    }
    return { width, height, segmentHeight: maxHeight, overlap: 200, segments };
  } finally {
    bitmap.close();
  }
}
