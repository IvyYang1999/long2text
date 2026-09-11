/**
 * Client side of AI correction: choose which merged lines are worth sending,
 * build their context, run the requests with bounded concurrency, and mark the
 * accepted changes inside rendered Markdown.
 */
import { isTimestamp, type Line } from "./structure";
import { LIMITS } from "./correct-contract";

export const LOW_CONFIDENCE = 95;
export const MAX_CANDIDATES = 16; // one round: the whole AI pass is bounded by REQUEST_TIMEOUT_MS
export const CONCURRENCY = 16;
export const REQUEST_TIMEOUT_MS = 14_000; // after this the OCR text stays
export const HEDGE_AFTER_MS = 5_000; // send a duplicate request if the first is slower than this
const JUNK_CONFIDENCE = 50; // below this the line is usually icon/emoji noise the model cannot fix
export const MAX_CONFLICTS = 15; // high-confidence lines pulled in by document-wide conflicts

export interface Candidate {
  y: number; // global top of the line (for scrolling the image to it)
  id: string;
  text: string;
  confidence: number;
  context: string;
}

export interface Correction {
  order: number; // candidate index = document order
  y: number;
  id: string;
  original: string;
  corrected: string;
  accepted: boolean;
}

const CJK = /[\u4e00-\u9fff]/;

function clip(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max);
}

function cjkCount(t: string): number {
  return (t.match(/[\u4e00-\u9fff]/g) || []).length;
}

function isWorthChecking(t: string): boolean {
  const words = (t.match(/[A-Za-z]{2,}/g) || []).length;
  return t.length >= 4 && (cjkCount(t) >= 3 || words >= 2);
}

/**
 * Evidence lines for a suspicious line: wherever a two-character anchor in the
 * target (e.g. "李子") is completed one way in the target ("李子破") but the
 * rest of the document consistently completes it another way ("李子玄" ×6),
 * return confident lines showing that other completion. Anchors with no
 * consensus (e.g. "没有" followed by many different characters) give nothing.
 */
function conflictLines(target: string, lines: Line[], self: number, near: Set<number>, strict = false): number[] {
  const t = [...target];
  const picked: number[] = [];
  const consider = (anchor: string, charAt: (text: string, pos: number) => string | undefined, own: string) => {
    if (!CJK.test(anchor[0]) || !CJK.test(anchor[1]) || !CJK.test(own)) return;
    const counts = new Map<string, number[]>();
    lines.forEach((o, k) => {
      if (k === self || o.conf < LOW_CONFIDENCE) return;
      let pos = o.text.indexOf(anchor);
      while (pos >= 0) {
        const c = charAt(o.text, pos);
        if (c && CJK.test(c)) counts.set(c, [...(counts.get(c) || []), k]);
        pos = o.text.indexOf(anchor, pos + 1);
      }
    });
    let best = "";
    let bestN = 0;
    let total = 0;
    for (const [c, ks] of counts) {
      total += ks.length;
      if (ks.length > bestN) [best, bestN] = [c, ks.length];
    }
    const ownN = counts.get(own)?.length || 0;
    // strict: used to pull in lines the OCR engine was confident about — needs a
    // concentrated consensus (≥3 and ≥60% of completions) against a rare variant
    // name-like: few distinct completions, one dominant, and this line's variant appears nowhere else
    const ok = strict
      ? bestN >= 4 && bestN / total >= 0.7 && counts.size <= 4 && ownN === 0
      : bestN >= 2 && bestN > ownN * 2;
    if (best && best !== own && ok) {
      for (const k of counts.get(best)!) if (!near.has(k) && !picked.includes(k) && picked.length < 3) picked.push(k);
    }
  };
  for (let j = 0; j < t.length; j++) {
    if (j >= 2) consider(t[j - 2] + t[j - 1], (x, p) => x[p + 2], t[j]); // anchor on the left
    if (j + 2 < t.length) consider(t[j + 1] + t[j + 2], (x, p) => x[p - 1], t[j]); // anchor on the right
    if (picked.length >= 3) break;
  }
  return picked;
}

/**
 * Lines worth proofreading, each with context (two lines either side plus
 * evidence lines from elsewhere in the document, see conflictLines):
 *  - lines the OCR engine was unsure about (confidence < LOW_CONFIDENCE), and
 *  - lines it was confidently wrong about: a rare variant that conflicts with
 *    a strong document-wide consensus ("李子玻" at 98% vs six "李子玄").
 * Conflicts go first, then lowest confidence; capped at MAX_CANDIDATES.
 */
export function pickCandidates(lines: Line[]): Candidate[] {
  const idx = lines
    .map((l, i) => {
      const t = l.text.trim();
      if (t.length > LIMITS.text || !isWorthChecking(t) || isTimestamp(t)) return null;
      const near = new Set([i - 2, i - 1, i + 1, i + 2]);
      const conflict = conflictLines(l.text, lines, i, near, true).length > 0;
      if (!conflict && l.conf < JUNK_CONFIDENCE) return null;
      return conflict || l.conf < LOW_CONFIDENCE ? { l, i, conflict } : null;
    })
    .filter((x): x is { l: Line; i: number; conflict: boolean } => x !== null)
    // conflicts first; then lines with more real text and lower confidence
    .sort((a, b) =>
      a.conflict === b.conflict
        ? (cjkCount(b.l.text) + 1) * (100 - b.l.conf) - (cjkCount(a.l.text) + 1) * (100 - a.l.conf)
        : a.conflict
          ? -1
          : 1,
    )
    .filter((x, k, arr) => !x.conflict || x.l.conf < LOW_CONFIDENCE || arr.slice(0, k).filter((y) => y.conflict).length < MAX_CONFLICTS)
    .slice(0, MAX_CANDIDATES)
    .sort((a, b) => a.i - b.i);

  return idx.map(({ l, i }) => {
    const near = new Set([i - 2, i - 1, i + 1, i + 2]);
    const before = [i - 2, i - 1].filter((k) => k >= 0).map((k) => lines[k].text.trim());
    const after = [i + 1, i + 2].filter((k) => k < lines.length).map((k) => lines[k].text.trim());
    const evidence = conflictLines(l.text, lines, i, near).sort((a, b) => a - b).map((k) => lines[k].text.trim());
    let context = [...before, ...after].join("\n");
    if (evidence.length) context = evidence.join("\n") + "\n……\n" + context;
    return { y: l.y, id: l.id, text: l.text, confidence: l.conf, context: clip(context, LIMITS.context) };
  });
}

/**
 * Every character the model introduces must already occur somewhere else in
 * the same document. "李子破→李子玄" passes (玄 appears six times); "电→電"
 * in a simplified-Chinese chat does not. This is the product-side reading of
 * the prompt's "只修正有充分上下文依据的".
 */
export function supportedByDocument(original: string, corrected: string, docChars: Map<string, number>): boolean {
  const own = new Map<string, number>();
  for (const ch of original) own.set(ch, (own.get(ch) || 0) + 1);
  for (const ch of corrected) {
    if (!/[\p{L}]/u.test(ch)) continue; // punctuation/digits are guarded elsewhere
    const left = own.get(ch) || 0;
    if (left > 0) {
      own.set(ch, left - 1);
      continue;
    }
    const inDoc = (docChars.get(ch) || 0) - (original.split(ch).length - 1);
    if (inDoc <= 0) return false;
  }
  return true;
}

export function charCounts(text: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const ch of text) m.set(ch, (m.get(ch) || 0) + 1);
  return m;
}

type Outcome = { status: "ok"; text: string; changed: boolean } | { status: "unavailable" } | { status: "failed" };

async function requestOnce(c: Candidate, signal: AbortSignal): Promise<Outcome> {
  try {
    const res = await fetch("/api/correct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: c.context, text: c.text, confidence: c.confidence }),
      signal,
    });
    if (res.status === 503) return { status: "unavailable" };
    if (!res.ok) return { status: "failed" };
    const data = await res.json();
    if (typeof data.text !== "string") return { status: "failed" };
    return { status: "ok", text: data.text, changed: !!data.changed && data.text !== c.text };
  } catch {
    return { status: "failed" };
  }
}

/**
 * One candidate with a hedged request: if the first call has not answered
 * after HEDGE_AFTER_MS (or fails fast), a duplicate is sent and the first
 * answer wins. The model's latency has a long tail (p50 ≈ 4 s, a few > 10 s),
 * so this keeps the whole pass short without dropping the slow lines.
 * Gives up after REQUEST_TIMEOUT_MS and keeps the OCR text.
 */
function correctOne(c: Candidate, outer?: AbortSignal): Promise<Outcome> {
  return new Promise((resolve) => {
    const ctrls: AbortController[] = [];
    let settled = false;
    let launched = 0;
    let pending = 0;
    const finish = (o: Outcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(overall);
      clearTimeout(hedge);
      ctrls.forEach((k) => k.abort());
      resolve(o);
    };
    const launch = () => {
      if (settled || launched >= 2) return;
      launched++;
      pending++;
      const k = new AbortController();
      ctrls.push(k);
      requestOnce(c, k.signal).then((o) => {
        pending--;
        if (o.status !== "failed") return finish(o);
        if (launched < 2) return launch(); // failed fast: hedge right away
        if (pending === 0) finish(o);
      });
    };
    const overall = setTimeout(() => finish({ status: "failed" }), REQUEST_TIMEOUT_MS);
    const hedge = setTimeout(launch, HEDGE_AFTER_MS);
    outer?.addEventListener("abort", () => finish({ status: "failed" }), { once: true });
    launch();
  });
}

/**
 * Runs all candidates with bounded concurrency. `onProgress` is called after
 * each finished request with the corrections found so far.
 * Resolves to "unavailable" when the server has no model configured.
 */
export async function runCorrections(
  candidates: Candidate[],
  docText: string,
  onProgress: (done: number, total: number, found: Correction[]) => void,
  signal?: AbortSignal,
): Promise<{ status: "done" | "unavailable"; corrections: Correction[] }> {
  const docChars = charCounts(docText);
  const found: Correction[] = [];
  let next = 0;
  let done = 0;
  let unavailable = false;
  const worker = async () => {
    while (!unavailable && !signal?.aborted && next < candidates.length) {
      const order = next++;
      const c = candidates[order];
      const r = await correctOne(c, signal);
      if (r.status === "unavailable") {
        unavailable = true;
        return;
      }
      if (r.status === "ok" && r.changed && supportedByDocument(c.text, r.text, docChars)) {
        found.push({ order, y: c.y, id: c.id, original: c.text, corrected: r.text, accepted: true });
        found.sort((a, b) => a.order - b.order);
      }
      done++;
      onProgress(done, candidates.length, [...found]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, candidates.length) }, worker));
  return { status: unavailable ? "unavailable" : "done", corrections: found };
}

// ── Markdown marking ────────────────────────────────────────────────
// Display-only markers (private-use code points, never copied/downloaded):
//   U+E000 <index> U+E003 <new span> U+E001 <old span> U+E002
export const MARK_RE = /\uE000(\d+)\uE003([^\uE001]*)\uE001([^\uE002]*)\uE002/g;

export function changedSpan(original: string, corrected: string) {
  const a = [...original];
  const b = [...corrected];
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  if (b.length - p - s === 0 && p > 0) p--; // pure deletion: highlight the neighbouring char
  return { p, s, newSpan: b.slice(p, b.length - s).join(""), oldSpan: a.slice(p, a.length - s).join("") };
}

/** Insert display markers for accepted corrections (in document order) into clean Markdown. */
export function markCorrections(markdown: string, corrections: Correction[]): string {
  let out = markdown;
  let cursor = 0;
  corrections.forEach((c, index) => {
    if (!c.accepted) return;
    const line = c.corrected.trim();
    const { p, newSpan, oldSpan } = changedSpan(c.original.trim(), c.corrected.trim());
    if (!newSpan && !oldSpan) return;
    let at = out.indexOf(line, cursor);
    let offset = p;
    if (at < 0) {
      // the line may have been reformatted; fall back to the span with a little context
      const lineChars = [...line];
      const from = Math.max(0, p - 4);
      const probe = lineChars.slice(from, p + [...newSpan].length + 4).join("");
      at = probe ? out.indexOf(probe, cursor) : -1;
      offset = p - from;
      if (at < 0) return;
    }
    const pos = at + [...line].slice(0, offset).join("").length;
    const marker = `\uE000${index}\uE003${newSpan}\uE001${oldSpan}\uE002`;
    out = out.slice(0, pos) + marker + out.slice(pos + newSpan.length);
    cursor = pos + marker.length;
  });
  return out;
}
