/**
 * Small-text enhancement: OCR engines lose accuracy below ~24px glyph height
 * (e.g. a screenshot embedded inside a chat). For such regions we re-run OCR
 * on a 2× upscaled crop and, line by line, keep whichever pass the engine was
 * more confident about. Lines that only the upscaled pass "found" are kept
 * only when they are long and near-certain (upscaling also invents junk from
 * icons).
 */
import { similarity, type OCRBlock } from "./structure";

export const SMALL_TEXT_PX = 24;
export const ENHANCE_SCALE = 2;
const MAX_REGION_HEIGHT = 1200; // source px per upscaled request
const REGION_GAP = 200;
const PAD = 12;

export interface Region {
  y0: number;
  y1: number;
}

/** Vertical regions (segment-local px) whose text is small enough to be worth a 2× pass. */
export function findSmallTextRegions(blocks: OCRBlock[], segmentHeight: number): Region[] {
  const small = blocks
    .filter((b) => b.height && b.height > 0 && b.height < SMALL_TEXT_PX && b.text.trim().length >= 2)
    .sort((a, b) => a.y - b.y);
  if (small.length < 2) return [];
  const regions: Region[] = [];
  let y0 = small[0].y;
  let y1 = small[0].y + (small[0].height || 0);
  for (let i = 1; i < small.length; i++) {
    const b = small[i];
    if (b.y - y1 > REGION_GAP) {
      regions.push({ y0, y1 });
      y0 = b.y;
    }
    y1 = Math.max(y1, b.y + (b.height || 0));
  }
  regions.push({ y0, y1 });
  // pad, clamp, and split tall regions
  const out: Region[] = [];
  for (const r of regions) {
    let a = Math.max(0, r.y0 - PAD);
    const b = Math.min(segmentHeight, r.y1 + PAD);
    while (b - a > MAX_REGION_HEIGHT) {
      out.push({ y0: a, y1: a + MAX_REGION_HEIGHT });
      a += MAX_REGION_HEIGHT - PAD * 2;
    }
    if (b - a > 20) out.push({ y0: a, y1: b });
  }
  return out;
}

/** Map blocks from an upscaled crop back into segment-local coordinates. */
export function unscaleBlocks(blocks: OCRBlock[], region: Region, scale: number): OCRBlock[] {
  return blocks.map((b) => ({
    ...b,
    x: b.x / scale,
    y: b.y / scale + region.y0,
    width: (b.width || 0) / scale,
    height: (b.height || 0) / scale,
  }));
}

/**
 * Merge the 2× pass into the original blocks of one region.
 * - matched line: keep the text of the more confident pass
 * - unmatched upscaled line: keep only if long and near-certain
 * - original lines are never dropped
 */
export function mergeEnhanced(original: OCRBlock[], enhanced: OCRBlock[], region: Region): OCRBlock[] {
  const inRegion = (b: OCRBlock) => b.y >= region.y0 && b.y <= region.y1;
  const result = original.map((b) => ({ ...b }));
  const used = new Set<number>();
  for (const e of enhanced) {
    const eh = e.height || 16;
    let best = -1;
    let bestScore = 0;
    for (let i = 0; i < result.length; i++) {
      const o = result[i];
      if (!inRegion(o) || used.has(i)) continue;
      if (Math.abs(o.y - e.y) > Math.max(eh, o.height || 16) * 0.7) continue;
      const s = similarity(o.text, e.text);
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    }
    if (best >= 0 && bestScore >= 0.45) {
      used.add(best);
      if ((e.confidence ?? 0) > (result[best].confidence ?? 0)) {
        result[best] = { ...result[best], text: e.text, confidence: e.confidence };
      }
    } else if ((e.confidence ?? 0) >= 96 && e.text.trim().length >= 6) {
      result.push(e);
    }
  }
  return result.sort((a, b) => a.y - b.y || a.x - b.x);
}
