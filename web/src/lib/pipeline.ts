/**
 * Recognition pipeline: OCR every segment through a bounded pool of parallel
 * requests; when a segment comes back with uncertain small text, its 2×
 * re-read joins the same pool. Tencent GeneralBasicOCR handled 20 parallel
 * requests with no errors in a 2026-09-11 test (≈3 s per request), so the
 * wall time is roughly ceil(tasks / CONCURRENCY) × 3 s.
 */
import type { ClientSegment } from "./client-splitter";
import { cropAndScale } from "./client-splitter";
import { findSmallTextRegions, unscaleBlocks, mergeEnhanced, ENHANCE_SCALE, type Region } from "./enhance";
import type { OCRBlock, SegmentResult } from "./structure";
import { detectFigures, dedupeFigures, type FigureBox } from "./figures";
import type { OcrProvider } from "./ocr-config";

const ANALYSIS_W = 360; // px width used to look for pictures

/** Pictures (stickers, photos…) in one slice, in slice px. Browser only. */
async function findFigures(blob: Blob, blocks: OCRBlock[]): Promise<FigureBox[]> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, ANALYSIS_W / bmp.width);
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high"; // area-averaged like the node tests; "low" aliases into fake texture
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const px = ctx.getImageData(0, 0, w, h);
  return detectFigures({ width: w, height: h, data: px.data }, scale, blocks);
}

export interface Figure extends FigureBox {
  id: string;
  blob: Blob;
  url: string;
}

/** Crop the found boxes out of the original file (full resolution). */
export async function cropFigures(file: Blob, boxes: FigureBox[]): Promise<Figure[]> {
  const out: Figure[] = [];
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    try {
      const x = Math.max(0, Math.round(b.x));
      const y = Math.max(0, Math.round(b.y));
      const bmp = await createImageBitmap(file, x, y, Math.max(1, Math.round(b.w)), Math.max(1, Math.round(b.h)));
      const canvas = document.createElement("canvas");
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      canvas.getContext("2d")!.drawImage(bmp, 0, 0);
      bmp.close();
      const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((bl) => (bl ? res(bl) : rej(new Error("crop failed"))), "image/jpeg", 0.9));
      out.push({ ...b, id: `img${i + 1}`, blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      console.error("[figures] crop failed", e);
    }
  }
  return out;
}

export const OCR_CONCURRENCY = 12;

async function ocrOnce(blob: Blob, name: string, provider: OcrProvider): Promise<OCRBlock[] | null> {
  let lastError = "";
  for (let attempt = 0; attempt < (provider === "google" ? 1 : 3); attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 700 * attempt));
    try {
      const form = new FormData();
      form.append("file", blob, name);
      form.append("provider", provider);
      const res = await fetch("/api/ocr", { method: "POST", body: form, signal: AbortSignal.timeout(55_000) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        lastError = data.detail || `HTTP ${res.status}`;
        if (res.status >= 400 && res.status < 500) break;
        continue;
      }
      return (data.blocks || []) as OCRBlock[];
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Network error";
    }
  }
  console.error(`[OCR] ${name} failed: ${lastError}`);
  return null;
}

export interface Progress {
  finished: number; // segments fully done (incl. their 2× passes)
  total: number;
  enhancing: number; // 2× passes queued or running
  etaSec: number | null;
  /** Finished segments forming a contiguous run from the top — safe to structure for a live preview. */
  prefix: SegmentResult[];
}

export async function recognize(
  segments: ClientSegment[],
  onProgress: (p: Progress) => void,
  provider: OcrProvider = "tencent",
): Promise<{ results: SegmentResult[]; failed: number[]; figures: FigureBox[] }> {
  const found: FigureBox[] = [];
  const results: (SegmentResult | null)[] = segments.map(() => null);
  const blocksOf: OCRBlock[][] = segments.map(() => []);
  const pendingZoom = segments.map(() => 0);
  const ocrDone = segments.map(() => false);
  const failed: number[] = [];
  let enhancing = 0;
  const started = Date.now();

  type Task = () => Promise<void>;
  const queue: Task[] = [];
  let active = 0;
  let resolveAll: () => void;
  const allDone = new Promise<void>((r) => (resolveAll = r));

  const finishedCount = () => results.filter(Boolean).length;
  const report = () => {
    const finished = finishedCount();
    const elapsed = (Date.now() - started) / 1000;
    const prefix: SegmentResult[] = [];
    for (const r of results) {
      if (!r) break;
      prefix.push(r);
    }
    const etaSec = finished > 0 && finished < segments.length ? Math.ceil((elapsed / finished) * (segments.length - finished)) : finished === segments.length ? 0 : null;
    onProgress({ finished, total: segments.length, enhancing, etaSec, prefix });
  };

  const maybeFinish = (i: number) => {
    if (!ocrDone[i] || pendingZoom[i] > 0 || results[i]) return;
    const s = segments[i];
    results[i] = { index: s.index, yStart: s.yStart, yEnd: s.yEnd, blocks: blocksOf[i] };
    report();
  };

  const pump = () => {
    while (active < (provider === "google" ? 2 : OCR_CONCURRENCY) && queue.length) {
      const task = queue.shift()!;
      active++;
      task().finally(() => {
        active--;
        if (queue.length === 0 && active === 0) resolveAll();
        else pump();
      });
    }
  };

  const zoomTask = (i: number, region: Region): Task => async () => {
    try {
      const s = segments[i];
      const crop = await cropAndScale(s.blob, region.y0, region.y1, ENHANCE_SCALE);
      const enhanced = await ocrOnce(crop, `segment-${s.index}-zoom.jpg`, provider);
      if (enhanced) blocksOf[i] = mergeEnhanced(blocksOf[i], unscaleBlocks(enhanced, region, ENHANCE_SCALE), region);
    } catch (e) {
      console.error("[OCR] enhance failed", e);
    } finally {
      pendingZoom[i]--;
      enhancing--;
      maybeFinish(i);
    }
  };

  segments.forEach((s, i) => {
    queue.push(async () => {
      const blocks = await ocrOnce(s.blob, `segment-${s.index}.jpg`, provider);
      if (!blocks) failed.push(i + 1);
      blocksOf[i] = blocks || [];
      if (blocks) {
        try {
          for (const f of await findFigures(s.blob, blocks)) found.push({ ...f, y: f.y + s.yStart });
        } catch (e) {
          console.error("[figures] detection failed", e);
        }
      }
      // Tencent zoom merging compares confidences from the same engine only.
      const regions = blocks && provider === "tencent" ? findSmallTextRegions(blocks, s.yEnd - s.yStart) : [];
      pendingZoom[i] = regions.length;
      enhancing += regions.length;
      // zoom passes go to the FRONT so a segment finishes soon after its first read
      queue.unshift(...regions.map((r) => zoomTask(i, r)));
      ocrDone[i] = true;
      maybeFinish(i);
    });
  });

  if (segments.length === 0) return { results: [], failed, figures: [] };
  report();
  pump();
  await allDone;
  failed.sort((a, b) => a - b);
  return { results: results.filter((r): r is SegmentResult => !!r), failed, figures: dedupeFigures(found) };
}
