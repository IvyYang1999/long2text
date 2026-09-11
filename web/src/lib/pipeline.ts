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

export const OCR_CONCURRENCY = 12;

async function ocrOnce(blob: Blob, name: string): Promise<OCRBlock[] | null> {
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 700 * attempt));
    try {
      const form = new FormData();
      form.append("file", blob, name);
      const res = await fetch("/api/ocr", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        lastError = data.detail || `HTTP ${res.status}`;
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
): Promise<{ results: SegmentResult[]; failed: number[] }> {
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
    while (active < OCR_CONCURRENCY && queue.length) {
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
      const enhanced = await ocrOnce(crop, `segment-${s.index}-zoom.jpg`);
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
      const blocks = await ocrOnce(s.blob, `segment-${s.index}.jpg`);
      if (!blocks) failed.push(i + 1);
      blocksOf[i] = blocks || [];
      const regions = blocks ? findSmallTextRegions(blocks, s.yEnd - s.yStart) : [];
      pendingZoom[i] = regions.length;
      enhancing += regions.length;
      // zoom passes go to the FRONT so a segment finishes soon after its first read
      queue.unshift(...regions.map((r) => zoomTask(i, r)));
      ocrDone[i] = true;
      maybeFinish(i);
    });
  });

  if (segments.length === 0) return { results: [], failed };
  report();
  pump();
  await allDone;
  failed.sort((a, b) => a - b);
  return { results: results.filter((r): r is SegmentResult => !!r), failed };
}
