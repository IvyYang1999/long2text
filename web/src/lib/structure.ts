/**
 * Structured merging + formatting of OCR output.
 *
 * Input: per-segment OCR blocks (one block ≈ one visual text line) with
 * segment-local coordinates. Output: de-duplicated global lines, grouped
 * into paragraphs, formatted as Markdown according to the scene.
 *
 * Pure functions, no DOM — runs in the browser and in node tests.
 */

export interface OCRBlock {
  /** Optional source paragraph hint; never spans image parts. */
  paragraphId?: string;
  text: string;
  confidence?: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface SegmentResult {
  index: number;
  yStart: number;
  yEnd: number;
  blocks: OCRBlock[];
}

export interface Line {
  paragraphId?: string;
  id: string; // "<segment index>:<block index>" — stable key for corrections
  conf: number; // OCR engine confidence 0-100
  text: string;
  x: number;
  y: number; // global top
  w: number;
  h: number;
}

export type Side = "left" | "right" | "full";

export interface Row {
  y: number;
  h: number;
  cells: Line[]; // left-to-right
}

/** A picture found in the screenshot (stickers, photos…), in global px. */
export interface FigureRef {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  alt: string;
}

export interface Paragraph {
  figure?: FigureRef;
  lines: Row[];
  x: number; // left edge of first row
  y: number;
  yEnd: number;
  h: number; // typical line height
  side: Side;
  text: string; // joined text
}

export type Scene = "general" | "chat" | "meeting" | "article";
export type DetectedScene = Exclude<Scene, "general">;

export interface StructuredResult {
  scene: DetectedScene;
  lines: Line[];
  paragraphs: Paragraph[];
  markdown: string;
  plain: string;
}

// ───────────────────────── helpers ─────────────────────────

const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/;
const TIME_RE =
  /^(?:(?:\d{4}[/\-.年]\s?\d{1,2}[/\-.月]\s?\d{1,2}日?)\s*)?(?:(?:星期|周)[一二三四五六日天]|昨天|今天|(?:上午|下午|晚上|凌晨))?\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?$/;
const DATE_RE = /^(?:\d{4}[/\-.年]\s?\d{1,2}[/\-.月]\s?\d{1,2}日?|(?:星期|周)[一二三四五六日天]|昨天|今天)\s*(?:\d{1,2}:\d{2})?$/;
const END_PUNCT = /[。！？!?…」』”）)\]】]$/;

export function isTimestamp(t: string): boolean {
  const s = t.trim();
  return TIME_RE.test(s) || DATE_RE.test(s);
}

export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Most common value (bucketed by `tol`). */
export function modeOf(values: number[], tol: number): number {
  let best = values[0] ?? 0;
  let bestN = -1;
  for (const v of values) {
    let n = 0;
    for (const u of values) if (Math.abs(u - v) <= tol) n++;
    if (n > bestN) { bestN = n; best = v; }
  }
  return best;
}

export function normalizeText(t: string): string {
  return t.replace(/[\s，,。.、:：;；!！?？'"“”‘’（）()\-—_]/g, "").toLowerCase();
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const k = s.slice(i, i + 2);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

/** Dice coefficient on character bigrams, 0..1 */
export function similarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return na === nb ? 1 : 0;
  const ba = bigrams(na);
  const bb = bigrams(nb);
  let inter = 0;
  for (const [k, v] of ba) inter += Math.min(v, bb.get(k) || 0);
  return (2 * inter) / (na.length - 1 + nb.length - 1);
}

function charCount(t: string): number {
  // CJK chars count 1, latin words count ~0.5 each char
  let n = 0;
  for (const ch of t) n += CJK.test(ch) ? 1 : 0.5;
  return n;
}

// ───────────────────────── merge ─────────────────────────

export function quantile(nums: number[], q: number): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

/** Lower-quartile pitch between consecutive lines ≈ the intra-paragraph line pitch. */
export function estimateLinePitch(ys: number[]): number {
  const sorted = [...ys].sort((a, b) => a - b);
  const diffs: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i] - sorted[i - 1];
    if (d >= 8 && d <= 160) diffs.push(d);
  }
  return quantile(diffs, 0.25) || 40;
}

/** Estimate the typical line (glyph box) height from blocks with GLOBAL y. */
function estimateLineHeight(blocks: { y: number; height?: number }[]): number {
  const hs = blocks.map((b) => b.height || 0).filter((h) => h > 6);
  if (hs.length >= 3) return median(hs);
  return estimateLinePitch(blocks.map((b) => b.y)) * 0.72; // glyph box ≈ 72% of pitch
}

/**
 * Merge per-segment blocks into a single global list, removing the
 * duplicates that come from the overlap zone between consecutive segments
 * and dropping lines that were cut by a segment edge.
 */
export function mergeSegments(segments: SegmentResult[], corrections?: Map<string, string>): Line[] {
  const sorted = [...segments].sort((a, b) => a.index - b.index);
  const all = sorted.flatMap((s) => s.blocks.map((b) => ({ y: b.y + s.yStart, height: b.height })));
  const lh = estimateLineHeight(all);
  const kept: Line[][] = [];

  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i];
    const segH = seg.yEnd - seg.yStart;
    const isFirst = i === 0;
    const isLast = i === sorted.length - 1;
    let lines: Line[] = seg.blocks
      .map((b, bi) => ({
        id: `${seg.index}:${bi}`,
        paragraphId: b.paragraphId ? `${seg.index}:${b.paragraphId}` : undefined,
        conf: b.confidence ?? 100,
        text: b.text,
        x: b.x,
        y: b.y + seg.yStart,
        w: b.width || charCount(b.text) * (b.height || lh),
        h: b.height || lh,
      }))
      .filter((l) => l.text.trim().length > 0);

    // Drop lines touching a segment edge (they are cut, the neighbour segment has the full line)
    lines = lines.filter((l) => {
      const localTop = l.y - seg.yStart;
      const localBottom = localTop + l.h;
      if (!isFirst && localTop < lh * 0.35) return false;
      if (!isLast && localBottom > segH - lh * 0.35) return false;
      return true;
    });

    if (i > 0) {
      const prev = kept[i - 1];
      const prevSeg = sorted[i - 1];
      const zoneTop = seg.yStart;
      const zoneBottom = prevSeg.yEnd;
      const drop = new Set<Line>();
      const dropPrev = new Set<Line>();
      for (const l of lines) {
        if (l.y + l.h / 2 > zoneBottom) continue; // outside overlap
        // candidates in previous segment at the same height
        const cands = prev.filter((p) => Math.abs(p.y - l.y) <= lh * 0.6 && p.y + p.h / 2 >= zoneTop);
        if (cands.length === 0) {
          // Nothing in prev at this height. If this line hugs the top of our
          // segment it is probably a fragment; otherwise keep it.
          if (l.y - seg.yStart < lh * 0.8) drop.add(l);
          continue;
        }
        let matched = false;
        for (const p of cands) {
          const sim = similarity(p.text, l.text);
          const dx = Math.abs(p.x - l.x);
          if (sim >= 0.6 || (dx < lh && sim >= 0.35)) {
            matched = true;
            // keep the copy farther from its own segment edge
            const distP = prevSeg.yEnd - (p.y + p.h);
            const distL = l.y - seg.yStart;
            if (distL > distP) dropPrev.add(p);
            else drop.add(l);
          }
        }
        if (!matched && l.y - seg.yStart < lh * 0.8) drop.add(l);
      }
      kept[i - 1] = prev.filter((p) => !dropPrev.has(p));
      lines = lines.filter((l) => !drop.has(l));
    }
    kept.push(lines);
  }

  // Corrections are applied only after de-duplication so they cannot change which copy survives
  const merged = kept.flat().map((l) => {
    const c = corrections?.get(l.id);
    return c !== undefined ? { ...l, text: c } : l;
  });
  merged.sort((a, b) => (Math.abs(a.y - b.y) <= lh * 0.4 ? a.x - b.x : a.y - b.y));
  return merged;
}

// ───────────────────────── paragraphs ─────────────────────────

function joinLineTexts(a: string, b: string): string {
  const at = a.trimEnd();
  const bt = b.trimStart();
  if (!at) return bt;
  if (!bt) return at;
  const lastA = at[at.length - 1];
  const firstB = bt[0];
  if (CJK.test(lastA) || CJK.test(firstB)) return at + bt;
  if (/-$/.test(at) && /^[a-z]/.test(firstB)) return at.slice(0, -1) + bt;
  return at + " " + bt;
}

export function buildRows(lines: Line[], lh: number): Row[] {
  const rows: Row[] = [];
  for (const l of lines) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - l.y) <= lh * 0.45) {
      last.cells.push(l);
      last.cells.sort((a, b) => a.x - b.x);
    } else {
      rows.push({ y: l.y, h: l.h, cells: [l] });
    }
  }
  return rows;
}

function rowText(r: Row): string {
  return r.cells.map((c) => c.text.trim()).join("  ");
}

function rowLeft(r: Row): number {
  return Math.min(...r.cells.map((c) => c.x));
}

export function buildParagraphs(lines: Line[], imageWidth: number): { paragraphs: Paragraph[]; lh: number } {
  if (lines.length === 0) return { paragraphs: [], lh: 0 };
  const lh = median(lines.map((l) => l.h)) || 28;
  const rows = buildRows(lines, lh);

  // intra-paragraph line pitch (lower quartile of row-to-row distances)
  const pitch = estimateLinePitch(rows.map((r) => r.y)) || lh * 1.4;

  // Anchors: the dominant left edge (left column) and the dominant right edge
  // among rows that reach into the right half (right-aligned bubbles).
  const rowRight = (r: Row) => Math.max(...r.cells.map((c) => c.x + c.w));
  const typicalW = median(rows.map((r) => rowRight(r) - rowLeft(r))) || imageWidth * 0.6;
  const lefts = rows.map(rowLeft);
  const leftAnchor = modeOf(lefts, lh * 0.4);
  const rights = rows.map(rowRight).filter((x) => x > imageWidth * 0.6);
  const rightAnchor = rights.length ? modeOf(rights, lh * 0.5) : -1;
  const sideOf = (r: Row): Side => {
    const left = rowLeft(r);
    const right = rowRight(r);
    const onLeft = Math.abs(left - leftAnchor) <= lh * 0.8;
    const indented = left - leftAnchor > lh * 0.8;
    const onRight = indented && ((rightAnchor > 0 && Math.abs(right - rightAnchor) <= lh * 1.2) || right > imageWidth * 0.62);
    if (onRight) return "right";
    if (onLeft) return "left";
    return "full";
  };

  const paragraphs: Paragraph[] = [];
  let cur: Row[] = [];
  const flush = () => {
    if (cur.length === 0) return;
    const text = cur.map(rowText).reduce((acc, t) => joinLineTexts(acc, t), "");
    const first = cur[0];
    const last = cur[cur.length - 1];
    const x = Math.min(...cur.map(rowLeft));
    paragraphs.push({ lines: cur, x, y: first.y, yEnd: last.y + last.h, h: median(cur.map((r) => r.h)), side: sideOf(first), text });
    cur = [];
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const prev = rows[i - 1];
    if (prev && cur.length > 0) {
      const gap = r.y - prev.y;
      const bigGap = gap > pitch * 1.3;
      const multiCell = r.cells.length > 1 || prev.cells.length > 1;
      const meta = isTimestamp(rowText(r)) || isTimestamp(rowText(prev));
      const shift = Math.abs(rowLeft(r) - rowLeft(prev)) > lh * 1.6 && rowText(prev).length > 0;
      const tiny = rowText(r).length <= 2 || rowText(prev).length <= 2; // a lone wrapped char has an unreliable box
      const sourceParagraph = r.cells[0]?.paragraphId;
      const sameSourceParagraph = !!sourceParagraph && [...r.cells, ...prev.cells].every(c => c.paragraphId === sourceParagraph);
      // Google glyph boxes shrink for words without ascenders/descenders (e.g.
      // “deck.”). A source paragraph hint prevents this becoming a new speaker;
      // spacing, indentation and metadata boundaries still apply normally.
      const sizeJump = !sameSourceParagraph && !tiny && prev.h > 0 && (r.h / prev.h > 1.45 || prev.h / r.h > 1.45);
      const prevW = rowRight(prev) - rowLeft(prev);
      const curW = rowRight(r) - rowLeft(r);
      // a lone short row (heading / name) followed by a much wider row
      const prevShort = cur.length === 1 && prevW < typicalW * 0.6 && curW > prevW * 1.6;
      if (bigGap || multiCell || meta || shift || sizeJump || prevShort) flush();
    }
    cur.push(r);
  }
  flush();
  return { paragraphs, lh };
}

// ───────────────────────── scene detection ─────────────────────────

function looksLikeName(p: Paragraph): boolean {
  const t = p.text.trim();
  if (p.lines.length !== 1) return false;
  if (charCount(t) > 12 || t.length < 1) return false;
  if (END_PUNCT.test(t) || /[，,：:、]$/.test(t)) return false;
  if (/^\d+[.、)]/.test(t)) return false;
  if (isTimestamp(t)) return false;
  return true;
}

export function detectScene(all: Paragraph[]): DetectedScene {
  const paragraphs = all.filter((p) => !p.figure);
  if (paragraphs.length === 0) return "article";
  let times = 0;
  let left = 0;
  let right = 0;
  let nameRows = 0;
  let colonNames = 0;
  const speakerCounts = new Map<string, number>();
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const t = p.text.trim();
    const isTime = isTimestamp(t) || p.lines[0].cells.some((c) => isTimestamp(c.text));
    if (isTime) times++;
    if (!isTime) {
      if (p.side === "right") right++;
      else if (p.side === "left") left++;
    }
    if (looksLikeName(p) && paragraphs[i + 1] && !looksLikeName(paragraphs[i + 1])) nameRows++;
    const m = t.match(/^([^\s：:]{1,8})[：:]\s*\S/);
    if (m) {
      colonNames++;
      speakerCounts.set(m[1], (speakerCounts.get(m[1]) || 0) + 1);
    }
  }
  const n = paragraphs.length;
  const bubbly = right / n >= 0.12 && left / n >= 0.12;
  if (bubbly || times >= 2 || (nameRows / n >= 0.2 && times >= 1)) return "chat";
  const distinct = speakerCounts.size;
  if (colonNames / n >= 0.3 && distinct > 0 && distinct <= 12 && colonNames / distinct >= 2) return "meeting";
  return "article";
}

// ───────────────────────── formatting ─────────────────────────

const cleanAlt = (s: string) => s.replace(/[\[\]()\n]/g, " ").replace(/\s+/g, " ").trim();
export const figMd = (f: FigureRef) => `![${cleanAlt(f.alt)}](fig:${f.id})`;

function fmtTime(t: string): string {
  return `*${t.trim()}*`;
}

const VOICE = /^[^\p{L}\p{N}]{0,3}(\d{1,3})\s*["”″'’]{1,2}\s*$/u;

function formatChat(paragraphs: Paragraph[], lh: number, labels: { me: string; other: string; voice?: string }): string {
  const out: string[] = [];
  let speaker: string | null = null;
  let pendingName: string | null = null;
  const knownNames = new Set<string>();
  const nonTime = paragraphs.filter((p) => !isTimestamp(p.text.trim()));
  const nRight = nonTime.filter((p) => p.side === "right").length;
  const nLeft = nonTime.filter((p) => p.side === "left").length;
  const hasBubbles = nRight >= Math.max(2, nonTime.length * 0.08) && nLeft >= Math.max(2, nonTime.length * 0.08);
  // In bubble chats a name row sits at the left column, slightly less indented than bubble text
  const leftColumn = modeOf(nonTime.filter((p) => p.side !== "right").map((p) => p.x), lh * 0.4);
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (p.figure) {
      if (hasBubbles) {
        const who = p.side === "right" ? labels.me : pendingName || labels.other;
        pendingName = null;
        out.push(`**${who}**：${figMd(p.figure)}`);
      } else out.push(figMd(p.figure));
      continue;
    }
    const cells = p.lines[0].cells;
    const text = p.text.trim();
    // pure timestamp / date row
    if (isTimestamp(text)) {
      out.push(fmtTime(text));
      continue;
    }
    // name row (optionally with a timestamp cell)
    if (p.lines.length === 1 && cells.length >= 2) {
      const timeCell = cells.find((c) => isTimestamp(c.text));
      const nameCell = cells.find((c) => !isTimestamp(c.text));
      if (timeCell && nameCell && charCount(nameCell.text) <= 12) {
        speaker = nameCell.text.trim();
        out.push(`**${speaker}** ${fmtTime(timeCell.text)}`);
        continue;
      }
    }
    const next = paragraphs[i + 1];
    const nameLike =
      !!next &&
      next.y - p.yEnd < lh * 1.8 &&
      (knownNames.has(text) || (looksLikeName(p) && (!!next.figure || !looksLikeName(next) || next.x - p.x > lh * 0.3)));
    if (nameLike) knownNames.add(text);
    if (nameLike && !hasBubbles) {
      speaker = text;
      out.push(`**${speaker}**`);
      continue;
    }
    // a name row sits at the left column, and the bubble under it is indented — except a picture message, which aligns with the name
    if (nameLike && hasBubbles && next.side !== "right" && p.side !== "right" && p.x <= leftColumn + lh * 0.5 && (next.figure || next.x - p.x > lh * 0.3)) {
      pendingName = text;
      continue;
    }
    const voice = text.match(VOICE);
    const shown = voice ? `[${labels.voice || "语音"} ${voice[1]}″]` : text;
    if (hasBubbles) {
      if (p.side === "full" && !pendingName) {
        out.push(text); // system / centered message
        continue;
      }
      const who = p.side === "right" ? labels.me : pendingName || labels.other;
      pendingName = null;
      out.push(`**${who}**：${shown}`);
    } else {
      out.push(shown);
    }
  }
  return out.join("\n\n");
}

function formatMeeting(paragraphs: Paragraph[], lh: number): string {
  const out: string[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (p.figure) {
      out.push(figMd(p.figure));
      continue;
    }
    const t = p.text.trim();
    if (isTimestamp(t)) {
      out.push(fmtTime(t));
      continue;
    }
    const m = t.match(/^([^\s：:]{1,12})[：:]\s*(\S.*)$/);
    if (m) {
      out.push(`**${m[1]}**：${m[2]}`);
      continue;
    }
    const next = paragraphs[i + 1];
    if (looksLikeName(p) && next && !looksLikeName(next) && next.y - p.yEnd < lh * 1.8) {
      out.push(`**${t}**`);
      continue;
    }
    out.push(t);
  }
  return out.join("\n\n");
}

function formatArticle(paragraphs: Paragraph[]): string {
  const text = paragraphs.filter((p) => !p.figure);
  const bodyH = median(text.filter((p) => p.lines.length >= 2).map((p) => p.h)) || median(text.map((p) => p.h));
  const out: string[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (p.figure) {
      out.push(figMd(p.figure));
      continue;
    }
    const t = p.text.trim();
    if (!t) continue;
    const big = bodyH > 0 && p.h >= bodyH * 1.22;
    const short = p.lines.length === 1 && charCount(t) <= 24 && !END_PUNCT.test(t) && !/[，,]$/.test(t);
    const next = paragraphs[i + 1];
    const followedByBody = !!next && next.lines.length >= 1 && charCount(next.text) > charCount(t);
    if (big && p.lines.length <= 2 && charCount(t) <= 40) {
      out.push(`${p.h >= bodyH * 1.5 ? "#" : "##"} ${t}`);
      continue;
    }
    if (short && followedByBody && p.h >= bodyH * 0.95) {
      out.push(`${i === 0 ? "#" : "##"} ${t}`);
      continue;
    }
    if (/^[•·●▪◦-]\s*/.test(t)) {
      out.push(t.replace(/^[•·●▪◦-]\s*/, "- "));
      continue;
    }
    if (/^\d{1,2}(?:[、)]|\.(?!\d))\s*/.test(t)) {
      out.push(t.replace(/^(\d{1,2})(?:[、)]|\.(?!\d))\s*/, "$1. "));
      continue;
    }
    out.push(t);
  }
  return out.join("\n\n");
}

function plainFromMarkdown(md: string): string {
  return md
    .replace(/!\[([^\]]*)\]\(fig:[^)]+\)/g, "[$1]")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$)/g, "$1$2");
}

export function structure(
  segments: SegmentResult[],
  imageWidth: number,
  scene: Scene = "general",
  labels: { me: string; other: string; voice?: string } = { me: "我", other: "对方" },
  corrections?: Map<string, string>,
  figures: FigureRef[] = [],
): StructuredResult {
  const all = mergeSegments(segments, corrections);
  // text inside a picture (a sticker's caption) belongs to the picture, not the prose
  const inside = (l: Line) => figures.some((f) => {
    const cx = l.x + l.w / 2;
    const cy = l.y + l.h / 2;
    return cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + f.h;
  });
  const lines = figures.length ? all.filter((l) => !inside(l)) : all;
  const built = buildParagraphs(lines, imageWidth);
  const lh = built.lh;
  const paragraphs = figures.length ? insertFigures(built.paragraphs, figures, imageWidth, lh) : built.paragraphs;
  const detected: DetectedScene = scene === "general" ? detectScene(paragraphs) : scene;
  let markdown: string;
  if (detected === "chat") markdown = formatChat(paragraphs, lh, labels);
  else if (detected === "meeting") markdown = formatMeeting(paragraphs, lh);
  else markdown = formatArticle(paragraphs);
  markdown = markdown.replace(/\n{3,}/g, "\n\n").trim();
  return { scene: detected, lines, paragraphs, markdown, plain: plainFromMarkdown(markdown) };
}

function insertFigures(paragraphs: Paragraph[], figures: FigureRef[], imageWidth: number, lh: number): Paragraph[] {
  const out = [...paragraphs];
  for (const f of [...figures].sort((a, b) => a.y - b.y)) {
    const center = f.x + f.w / 2;
    const side: Side = center > imageWidth * 0.55 ? "right" : f.x < imageWidth * 0.3 ? "left" : "full";
    const para: Paragraph = { figure: f, lines: [], x: f.x, y: f.y, yEnd: f.y + f.h, h: lh, side, text: "" };
    const at = out.findIndex((p) => p.y > f.y);
    if (at < 0) out.push(para);
    else out.splice(at, 0, para);
  }
  return out;
}

/** Text lines (with their ids) inside a figure — used as its fallback caption. */
export function textInside(segments: SegmentResult[], f: { x: number; y: number; w: number; h: number }): string {
  return mergeSegments(segments)
    .filter((l) => {
      const cx = l.x + l.w / 2;
      const cy = l.y + l.h / 2;
      return cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + f.h;
    })
    .map((l) => l.text.trim())
    .join(" ")
    .slice(0, 40);
}

/** First `ratio` of the markdown by paragraph count (at least `min` paragraphs). */
export function previewOf(markdown: string, ratio = 0.3, min = 6): string {
  const parts = markdown.split(/\n\n+/);
  const n = Math.max(min, Math.ceil(parts.length * ratio));
  return parts.slice(0, n).join("\n\n");
}
