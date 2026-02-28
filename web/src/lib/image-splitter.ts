/**
 * Split a long/tall image into overlapping vertical segments.
 * Uses Sharp for image processing - runs on Node.js (Vercel serverless).
 */
import sharp from "sharp";

export interface Segment {
  index: number;
  yStart: number;
  yEnd: number;
  buffer: Buffer;
}

export interface SplitResult {
  width: number;
  height: number;
  segmentHeight: number;
  overlap: number;
  segments: Segment[];
}

function calculateSegmentHeight(width: number, height: number): number {
  let base: number;
  if (width <= 500) base = 1500;
  else if (width <= 1000) base = 1200;
  else if (width <= 1500) base = 1000;
  else base = 800;
  return Math.max(600, Math.min(2000, base));
}

export async function splitImage(
  imageBuffer: Buffer,
  overlap = 200,
): Promise<SplitResult> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width!;
  const height = metadata.height!;
  const segmentHeight = calculateSegmentHeight(width, height);

  // No splitting needed for short images
  if (height <= segmentHeight * 1.3) {
    return {
      width,
      height,
      segmentHeight: height,
      overlap: 0,
      segments: [
        {
          index: 0,
          yStart: 0,
          yEnd: height,
          buffer: await sharp(imageBuffer).png().toBuffer(),
        },
      ],
    };
  }

  const step = segmentHeight - overlap;
  const segments: Segment[] = [];
  let y = 0;
  let i = 0;

  while (y < height) {
    const yEnd = Math.min(y + segmentHeight, height);
    const cropHeight = yEnd - y;

    const segBuffer = await sharp(imageBuffer)
      .extract({ left: 0, top: y, width, height: cropHeight })
      .png()
      .toBuffer();

    segments.push({
      index: i,
      yStart: y,
      yEnd,
      buffer: segBuffer,
    });

    y += step;
    i++;
  }

  return { width, height, segmentHeight, overlap, segments };
}
