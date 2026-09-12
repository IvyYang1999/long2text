import { gzip } from "node:zlib";
import { promisify } from "node:util";
import { visionToBlocks, type VisionAnnotation } from "./google-vision-adapter";

const compress = promisify(gzip);

export class GoogleOcrError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** No automatic retries or provider fallback: one upload means one paid call. */
export async function googleOcrImage(image: Buffer, width: number, height: number) {
  const key = process.env.GOOGLE_VISION_API_KEY?.trim();
  if (!key) throw new GoogleOcrError(503, "OCR is not configured");
  const body = await compress(Buffer.from(JSON.stringify({ requests: [{
    image: { content: image.toString("base64") },
    features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
  }] })), { level: 1 });
  try {
    const response = await fetch("https://vision.googleapis.com/v1/images:annotate?prettyPrint=false", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(45_000),
      headers: {
        "Content-Type": "application/json", "Content-Encoding": "gzip",
        "Accept-Encoding": "gzip", "User-Agent": "Long2Text/1.0 (gzip)",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "responses.error,responses.fullTextAnnotation",
      },
      body: new Uint8Array(body),
    });
    // Never propagate provider error bodies, which can contain credentials or input.
    if (!response.ok) {
      await response.body?.cancel();
      throw new GoogleOcrError(response.status === 429 ? 429 : 502, "OCR service is temporarily unavailable");
    }
    // Node fetch decompresses the gzip response; do not gunzip it a second time.
    const data = await response.json() as { responses?: { error?: { code?: number }; fullTextAnnotation?: VisionAnnotation }[] };
    if (!Array.isArray(data.responses) || data.responses.length !== 1) throw new Error("Invalid response");
    const result = data.responses[0];
    if (result.error) throw new GoogleOcrError(result.error.code === 8 ? 429 : 502, "OCR service is temporarily unavailable");
    return visionToBlocks(result.fullTextAnnotation ?? {}, width, height);
  } catch (error) {
    if (error instanceof GoogleOcrError) throw error;
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new GoogleOcrError(504, "OCR timed out. Please try again");
    }
    throw new GoogleOcrError(502, "OCR service returned an invalid response");
  }
}
