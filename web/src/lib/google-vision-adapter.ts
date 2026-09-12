import type { OCRBlock } from "./structure";
import { isTimestamp } from "./structure";

interface BoundingBox { vertices?: { x?: number; y?: number }[] }
interface Property { detectedBreak?: { type?: string; isPrefix?: boolean } }
interface Symbol { text?: string; confidence?: number; boundingBox?: BoundingBox; property?: Property }
interface Word { symbols?: Symbol[]; confidence?: number; boundingBox?: BoundingBox }
export interface VisionAnnotation {
  text?: string;
  pages?: { width?: number; height?: number; blocks?: {
    paragraphs?: { words?: Word[]; confidence?: number }[];
  }[] }[];
}

/** Reconstruct visual lines, not Google paragraphs or individual CJK words.
 * Coordinates stay in source pixels; confidences become the existing 0–100 scale.
 */
export function visionToBlocks(annotation: VisionAnnotation, width: number, height: number): OCRBlock[] {
  const pages = annotation.pages ?? [];
  if (!pages.length) {
    if (annotation.text?.trim()) throw new Error("Missing OCR geometry");
    return [];
  }
  if (pages.length !== 1 || pages[0].width !== width || pages[0].height !== height) {
    throw new Error("Unexpected OCR dimensions");
  }
  const result: OCRBlock[] = [];
  let paragraphIndex = 0;
  for (const block of pages[0].blocks ?? []) for (const paragraph of block.paragraphs ?? []) {
    const paragraphId = `google:${paragraphIndex++}`;
    let text = "";
    let left = Infinity, top = Infinity, right = 0, bottom = 0;
    let confidence = 0, count = 0;
    const flush = () => {
      if (text.trim()) result.push({ text: text.trim(), paragraphId, x: left, y: top,
        width: right - left, height: bottom - top, confidence: Math.round(100 * confidence / count) });
      text = ""; left = top = Infinity; right = bottom = confidence = count = 0;
    };
    const applyBreak = (type?: string) => {
      if (type === "SPACE" || type === "SURE_SPACE") text += " ";
      else if (type === "HYPHEN") { text += "-"; flush(); }
      else if (type === "LINE_BREAK" || type === "EOL_SURE_SPACE") flush();
    };
    for (const word of paragraph.words ?? []) for (const symbol of word.symbols ?? []) {
      if (!symbol.text) continue;
      const vertices = (symbol.boundingBox ?? word.boundingBox)?.vertices;
      if (!vertices || vertices.length !== 4) throw new Error("Missing OCR geometry");
      const xs = vertices.map(v => v.x ?? 0), ys = vertices.map(v => v.y ?? 0);
      if (xs.some(x => !Number.isFinite(x) || x < 0 || x > width) ||
          ys.some(y => !Number.isFinite(y) || y < 0 || y > height)) throw new Error("Invalid OCR geometry");
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      if (x1 <= x0 || y1 <= y0) throw new Error("Invalid OCR geometry");
      const br = symbol.property?.detectedBreak;
      if (br?.isPrefix) applyBreak(br.type);
      // Missing break hints must not glue a sender name onto the next message.
      if (count && Math.min(bottom, y1) - Math.max(top, y0) <= 0) flush();
      text += symbol.text;
      left = Math.min(left, x0); top = Math.min(top, y0);
      right = Math.max(right, x1); bottom = Math.max(bottom, y1);
      const score = symbol.confidence ?? word.confidence ?? paragraph.confidence ?? 0;
      const n = [...symbol.text].length;
      confidence += (Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0) * n;
      count += n;
      if (br && !br.isPrefix) applyBreak(br.type);
    }
    flush();
  }
  if (!result.length && annotation.text?.trim()) throw new Error("Missing OCR geometry");
  return mergeLineFragments(result);
}

/** Google can return two separate paragraphs on one visual line. Coalesce
 * nearby pieces so the layout engine doesn't treat them as table cells.
 * Keep distant columns and timestamp/name cells separate.
 */
export function mergeLineFragments(blocks: OCRBlock[]): OCRBlock[] {
  const rows: OCRBlock[][] = [];
  for (const block of [...blocks].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.at(-1), anchor = row?.[0];
    const overlap = anchor ? Math.min(anchor.y + anchor.height!, block.y + block.height!) - Math.max(anchor.y, block.y) : 0;
    if (anchor && overlap >= Math.min(anchor.height!, block.height!) * .6) row!.push(block);
    else rows.push([block]);
  }
  return rows.flatMap(row => {
    const merged: OCRBlock[] = [];
    for (const block of row.sort((a, b) => a.x - b.x)) {
      const previous = merged.at(-1);
      const gap = previous ? block.x - previous.x - previous.width! : Infinity;
      if (previous && gap >= 0 && gap <= Math.max(previous.height!, block.height!) * 2 &&
          !isTimestamp(previous.text) && !isTimestamp(block.text)) {
        const n = previous.text.length, m = block.text.length;
        const separator = /[\u3400-\u9fff]$/.test(previous.text) && /^[\u3400-\u9fff]/.test(block.text) ? "" : " ";
        const bottom = Math.max(previous.y + previous.height!, block.y + block.height!);
        previous.text += separator + block.text;
        previous.confidence = Math.round(((previous.confidence ?? 0) * n + (block.confidence ?? 0) * m) / (n + m));
        previous.width = block.x + block.width! - previous.x;
        previous.y = Math.min(previous.y, block.y); previous.height = bottom - previous.y;
        if (previous.paragraphId !== block.paragraphId) delete previous.paragraphId;
      } else merged.push({ ...block });
    }
    return merged;
  });
}
