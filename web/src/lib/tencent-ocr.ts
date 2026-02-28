/**
 * Tencent Cloud OCR API client.
 * Uses GeneralBasicOCR for text recognition.
 *
 * Pricing: 1000 free calls/month, then ~¥0.006/call.
 * Docs: https://cloud.tencent.com/document/product/866/33526
 */
import * as tencentcloud from "tencentcloud-sdk-nodejs-ocr";

const OcrClient = tencentcloud.ocr.v20181119.Client;

let client: InstanceType<typeof OcrClient> | null = null;

function getClient() {
  if (!client) {
    const secretId = process.env.TENCENT_SECRET_ID;
    const secretKey = process.env.TENCENT_SECRET_KEY;

    if (!secretId || !secretKey) {
      throw new Error(
        "Missing TENCENT_SECRET_ID or TENCENT_SECRET_KEY environment variables",
      );
    }

    client = new OcrClient({
      credential: { secretId, secretKey },
      region: "ap-beijing",
      profile: {
        httpProfile: { endpoint: "ocr.tencentcloudapi.com" },
      },
    });
  }
  return client;
}

export interface OCRBlock {
  text: string;
  confidence: number;
  y: number;
  x: number;
}

/**
 * Run OCR on an image buffer using Tencent Cloud.
 */
export async function ocrImage(imageBuffer: Buffer): Promise<OCRBlock[]> {
  const c = getClient();
  const base64 = imageBuffer.toString("base64");

  const resp = await c.GeneralBasicOCR({
    ImageBase64: base64,
    LanguageType: "auto",
  });

  if (!resp.TextDetections) return [];

  return resp.TextDetections.map((det) => ({
    text: det.DetectedText || "",
    confidence: det.Confidence || 0,
    y: det.ItemPolygon?.Y || 0,
    x: det.ItemPolygon?.X || 0,
  }));
}

/**
 * Merge OCR results from overlapping segments, removing duplicates.
 */
export function mergeOCRResults(
  allResults: OCRBlock[][],
  overlap: number,
  segmentHeight: number,
): string {
  if (allResults.length === 0) return "";
  if (allResults.length === 1) {
    return allResults[0].map((b) => b.text).join("\n");
  }

  const lines: string[] = [];
  let prevBottomTexts = new Set<string>();

  for (let segIdx = 0; segIdx < allResults.length; segIdx++) {
    const blocks = allResults[segIdx];

    for (const block of blocks) {
      // Skip duplicates from overlap zone
      if (segIdx > 0 && block.y < overlap * 0.8) {
        const key = block.text.trim();
        if (prevBottomTexts.has(key)) continue;
      }
      lines.push(block.text);
    }

    // Track bottom overlap texts for next segment dedup
    prevBottomTexts = new Set<string>();
    for (const block of blocks) {
      if (block.y > segmentHeight - overlap) {
        prevBottomTexts.add(block.text.trim());
      }
    }
  }

  return lines.join("\n");
}

/**
 * Format raw text as markdown based on scene type.
 */
export function formatAsMarkdown(
  rawText: string,
  scene: string,
): string {
  const lines = rawText.split("\n").filter((l) => l.trim());

  if (scene === "chat") {
    return lines.join("\n\n");
  }

  if (scene === "article") {
    // Try to merge consecutive short lines into paragraphs
    const paragraphs: string[] = [];
    let current: string[] = [];

    for (const line of lines) {
      current.push(line);
      // Heuristic: end of paragraph if line is short or ends with period
      if (
        line.endsWith("。") ||
        line.endsWith(".") ||
        line.endsWith("!") ||
        line.endsWith("！") ||
        line.length < 20
      ) {
        paragraphs.push(current.join(""));
        current = [];
      }
    }
    if (current.length) paragraphs.push(current.join(""));

    return paragraphs.join("\n\n");
  }

  // general / meeting
  return lines.join("\n");
}
