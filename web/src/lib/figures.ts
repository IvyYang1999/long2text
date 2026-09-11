/**
 * Find non-text visuals (stickers, photos, cards, charts) in a screenshot slice.
 *
 * The slice is analysed at a small scale on a grid of cells. A cell is "busy"
 * when its pixels have texture (luminance spread) and it is not covered by an
 * OCR text box. Busy cells are joined into regions; a region is kept as a
 * figure when it is big enough, mostly filled (flat chat bubbles and their thin
 * outlines are not) and not an avatar-sized square hugging the left/right edge.
 *
 * Pure function over RGBA pixels, so it runs in the browser (canvas) and in node.
 */
import type { OCRBlock } from "./structure";

export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array; // RGBA
}

export interface FigureBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CELL = 6; // analysis px
const BUSY_STD = 16; // luminance standard deviation inside a cell
const MIN_FILL = 0.28; // busy cells / region cells (chat bubble outlines measure 0.1–0.2)
const MIN_SIDE = 0.1; // × slice width
const MIN_AREA = 0.015; // × width² (a link-card thumbnail is ≈ 0.02)
const EDGE = 0.16; // avatar columns on the left/right

/**
 * @param px     slice pixels at analysis scale
 * @param scale  analysis px per slice px (≤ 1)
 * @param blocks OCR boxes in slice px
 * @returns figure boxes in slice px
 */
export function detectFigures(px: Pixels, scale: number, blocks: OCRBlock[]): FigureBox[] {
  const { width: W, height: H, data } = px;
  const gw = Math.ceil(W / CELL);
  const gh = Math.ceil(H / CELL);
  const busy = new Uint8Array(gw * gh);
  const color = new Float32Array(gw * gh * 3); // mean RGB per cell

  // text mask in cells (boxes padded a little)
  const text = new Uint8Array(gw * gh);
  for (const b of blocks) {
    if (!b.width || !b.height) continue;
    const pad = Math.max(2, b.height * 0.25);
    const x0 = Math.max(0, Math.floor(((b.x - pad) * scale) / CELL));
    const y0 = Math.max(0, Math.floor(((b.y - pad) * scale) / CELL));
    const x1 = Math.min(gw - 1, Math.floor(((b.x + b.width + pad) * scale) / CELL));
    const y1 = Math.min(gh - 1, Math.floor(((b.y + b.height + pad) * scale) / CELL));
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) text[gy * gw + gx] = 1;
  }

  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let n = 0;
      let sum = 0;
      let sum2 = 0;
      let cr = 0;
      let cg = 0;
      let cb = 0;
      const ys = gy * CELL;
      const xs = gx * CELL;
      for (let y = ys; y < Math.min(H, ys + CELL); y++) {
        for (let x = xs; x < Math.min(W, xs + CELL); x++) {
          const i = (y * W + x) * 4;
          const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          sum += l;
          sum2 += l * l;
          cr += data[i];
          cg += data[i + 1];
          cb += data[i + 2];
          n++;
        }
      }
      const k = gy * gw + gx;
      color[k * 3] = cr / n;
      color[k * 3 + 1] = cg / n;
      color[k * 3 + 2] = cb / n;
      if (text[k]) continue;
      const mean = sum / n;
      const std = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
      if (std > BUSY_STD) busy[k] = 1;
    }
  }

  const sliceW = W / scale;
  const components = (bridge: number) => {
    const seen = new Uint8Array(gw * gh);
    const regions: { x0: number; y0: number; x1: number; y1: number; n: number; cells: number[] }[] = [];
    const stack: number[] = [];
    for (let start = 0; start < busy.length; start++) {
      if (!busy[start] || seen[start]) continue;
      let x0 = gw, y0 = gh, x1 = 0, y1 = 0;
      const cells: number[] = [];
      stack.push(start);
      seen[start] = 1;
      while (stack.length) {
        const c = stack.pop()!;
        const cx = c % gw;
        const cy = (c - cx) / gw;
        cells.push(c);
        if (cx < x0) x0 = cx;
        if (cx > x1) x1 = cx;
        if (cy < y0) y0 = cy;
        if (cy > y1) y1 = cy;
        for (let dy = -bridge; dy <= bridge; dy++) {
          for (let dx = -bridge; dx <= bridge; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
            const k = ny * gw + nx;
            if (busy[k] && !seen[k]) {
              seen[k] = 1;
              stack.push(k);
            }
          }
        }
      }
      regions.push({ x0, y0, x1, y1, n: cells.length, cells });
    }
    return regions;
  };

  // Chat avatars (photos) live in gutters left and right of the bubbles. The
  // text boxes tell us where the bubble column is; when there is a clear
  // gutter, blank it so stickers next to an avatar aren't joined to it.
  // Articles have text edge to edge, so nothing is blanked there.
  const sized = blocks.filter((b) => b.width && b.text.trim().length >= 2);
  if (sized.length >= 3) {
    const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))];
    const left = q(sized.map((b) => b.x), 0.1);
    const right = q(sized.map((b) => b.x + (b.width || 0)), 0.9);
    const margin = 0.02 * sliceW;
    const maskLeftTo = left > 0.08 * sliceW ? Math.floor(((left - margin) * scale) / CELL) : -1;
    const maskRightFrom = right < 0.92 * sliceW ? Math.ceil(((right + margin) * scale) / CELL) : gw;
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx <= maskLeftTo; gx++) busy[gy * gw + gx] = 0;
      for (let gx = Math.max(0, maskRightFrom); gx < gw; gx++) busy[gy * gw + gx] = 0;
    }
  }

  // Pass 2: join what is left, bridging gaps of one cell
  const regions = components(2);

  // Page background = the most common cell colour (quantised)
  const hist = new Map<number, number>();
  for (let k = 0; k < gw * gh; k++) {
    const key = ((color[k * 3] >> 3) << 10) | ((color[k * 3 + 1] >> 3) << 5) | (color[k * 3 + 2] >> 3);
    hist.set(key, (hist.get(key) || 0) + 1);
  }
  let bgKey = 0;
  let bgN = -1;
  for (const [key, n] of hist) if (n > bgN) [bgKey, bgN] = [key, n];
  const bg = [((bgKey >> 10) & 31) * 8 + 4, ((bgKey >> 5) & 31) * 8 + 4, (bgKey & 31) * 8 + 4];
  const offPage = (k: number) =>
    text[k] === 1 || Math.abs(color[k * 3] - bg[0]) + Math.abs(color[k * 3 + 1] - bg[1]) + Math.abs(color[k * 3 + 2] - bg[2]) > 24;

  /**
   * Grow a picture to the frame it sits in: a sticker's white card with its
   * caption, a link card's title and source. Stops at the page background.
   */
  const grow = (r: { x0: number; y0: number; x1: number; y1: number }) => {
    const maxW = Math.floor((0.86 * W) / CELL);
    let { x0, y0, x1, y1 } = r;
    const colOk = (cx: number) => {
      if (cx < 0 || cx >= gw) return false;
      let n = 0;
      for (let cy = y0; cy <= y1; cy++) n += offPage(cy * gw + cx) ? 1 : 0;
      return n >= 0.85 * (y1 - y0 + 1);
    };
    const rowOk = (cy: number) => {
      if (cy < 0 || cy >= gh) return false;
      let n = 0;
      for (let cx = x0; cx <= x1; cx++) n += offPage(cy * gw + cx) ? 1 : 0;
      return n >= 0.85 * (x1 - x0 + 1);
    };
    for (let changed = true, guard = 0; changed && guard < 400; guard++) {
      changed = false;
      if (x1 - x0 < maxW && colOk(x0 - 1)) {
        x0--;
        changed = true;
      }
      if (x1 - x0 < maxW && colOk(x1 + 1)) {
        x1++;
        changed = true;
      }
      if (rowOk(y0 - 1)) {
        y0--;
        changed = true;
      }
      if (rowOk(y1 + 1)) {
        y1++;
        changed = true;
      }
    }
    return { x0, y0, x1, y1 };
  };

  const out: FigureBox[] = [];
  for (const r0 of regions) {
    const r = r0;
    const cells = (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
    let textCells = 0;
    for (let gy = r.y0; gy <= r.y1; gy++) for (let gx = r.x0; gx <= r.x1; gx++) textCells += text[gy * gw + gx];
    const fill = r.n / cells; // text and flat bubble cells count as empty
    const box = {
      x: (r.x0 * CELL) / scale,
      y: (r.y0 * CELL) / scale,
      w: ((r.x1 - r.x0 + 1) * CELL) / scale,
      h: ((r.y1 - r.y0 + 1) * CELL) / scale,
    };
    if (Math.min(box.w, box.h) < MIN_SIDE * sliceW) continue;
    if (box.w * box.h < MIN_AREA * sliceW * sliceW) continue;
    if (fill < MIN_FILL) continue;
    if (textCells / cells > 0.5) continue; // mostly text: a text block, not a picture
    const avatar = (box.x + box.w < EDGE * sliceW || box.x > (1 - EDGE) * sliceW) && box.w < 0.2 * sliceW;
    if (avatar) continue;
    // Texture that hugs text boxes is leftover strokes of small text (a text bubble), not a picture
    let nearText = 0;
    for (const c of r.cells) {
      const cx = c % gw;
      const cy = (c - cx) / gw;
      let hit = false;
      for (let dy = -1; dy <= 1 && !hit; dy++)
        for (let dx = -1; dx <= 1 && !hit; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && ny >= 0 && nx < gw && ny < gh && text[ny * gw + nx]) hit = true;
        }
      if (hit) nearText++;
    }
    if (nearText / r.n > 0.5) continue;
    const g = grow(r);
    out.push({ x: (g.x0 * CELL) / scale, y: (g.y0 * CELL) / scale, w: ((g.x1 - g.x0 + 1) * CELL) / scale, h: ((g.y1 - g.y0 + 1) * CELL) / scale });
  }
  return out;
}

/**
 * Merge boxes found in overlapping slices (boxes in global px): duplicates and
 * the two halves of a picture that straddles a slice boundary become one box.
 */
export function dedupeFigures<T extends FigureBox>(boxes: T[]): T[] {
  const out: T[] = [];
  for (const b of [...boxes].sort((a, c) => a.y - c.y)) {
    const hit = out.find((k) => {
      const ix = Math.min(k.x + k.w, b.x + b.w) - Math.max(k.x, b.x);
      const gapY = Math.max(k.y, b.y) - Math.min(k.y + k.h, b.y + b.h); // < 0 when overlapping
      return ix > 0.6 * Math.min(k.w, b.w) && gapY < 12;
    });
    if (!hit) {
      out.push({ ...b });
      continue;
    }
    const x0 = Math.min(hit.x, b.x);
    const y0 = Math.min(hit.y, b.y);
    hit.w = Math.max(hit.x + hit.w, b.x + b.w) - x0;
    hit.h = Math.max(hit.y + hit.h, b.y + b.h) - y0;
    hit.x = x0;
    hit.y = y0;
  }
  return out;
}
