"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { splitImageInBrowser } from "@/lib/client-splitter";
import { recognize, cropFigures, type Figure } from "@/lib/pipeline";
import { structure, previewOf, textInside, type SegmentResult, type Scene, type DetectedScene, type Line, type FigureRef } from "@/lib/structure";
import { withImageFiles, figureIds, toHtml, toStyledHtml, makeZip, applyMode, type OutputMode } from "@/lib/export";
import { pickCandidates, runCorrections, markCorrections, changedSpan, type Correction } from "@/lib/ai-correct";
import { FREE_CHARS, PREVIEW_PERCENT, dicts, type Locale } from "@/lib/i18n";
import MarkdownView from "@/components/MarkdownView";
import CaseShowcase from "@/components/CaseShowcase";
import {
  IconUpload,
  IconLock,
  IconCopy,
  IconDownload,
  IconPlus,
  IconSparkle,
  IconCheck,
  IconImage,
  IconUndo,
} from "@/components/Icons";

type Phase = "idle" | "splitting" | "processing" | "done" | "error";
type AiState = "off" | "running" | "done" | "unavailable";
type Labels = { me: string; other: string; image: string; voice: string };
type Pic = Figure & { ocrText: string; desc?: string };

interface Result {
  rid: string;
  id?: string; // database id once saved
  name: string;
  imageUrl?: string;
  imageWidth: number;
  imageHeight: number;
  segments: SegmentResult[];
  sceneChoice: Scene;
  scene: DetectedScene;
  markdown: string;
  plain: string;
  preview: string;
  totalChars: number;
  totalBlocks: number;
  slices: number;
  failed: number[];
  secs: number;
  isPaid: boolean;
  isDownloaded: boolean;
  corrections: Correction[];
  figures: Pic[];
  describe: "idle" | "running" | "done";
  descDone: number;
  ai: AiState;
  aiDone: number;
  aiTotal: number;
  dirty: boolean;
}

interface Live {
  finished: number;
  total: number;
  enhancing: number;
  etaSec: number | null;
  markdown: string;
}

const AI_PREF_KEY = "l2t-ai-correct";
const MODE_KEY = "l2t-output-mode";
const PREVIEW_RATIO = PREVIEW_PERCENT / 100;
const countChars = (s: string) => s.replace(/\s/g, "").length;

const figRefs = (figs: Pic[], label: string): FigureRef[] =>
  figs.map((f) => ({ id: f.id, x: f.x, y: f.y, w: f.w, h: f.h, alt: f.desc || f.ocrText || label }));

async function toDataUrl(blob: Blob, maxW?: number): Promise<string> {
  if (!maxW) return await new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.readAsDataURL(blob);
  });
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, maxW / bmp.width);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * k));
  c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL("image/jpeg", 0.82);
}

function rebuild(r: Result, labels: Labels): Result {
  if (r.segments.length === 0) return r;
  const map = new Map(r.corrections.filter((c) => c.accepted).map((c) => [c.id, c.corrected] as [string, string]));
  const s = structure(r.segments, r.imageWidth, r.sceneChoice, labels, map, figRefs(r.figures, labels.image));
  return {
    ...r,
    scene: s.scene,
    markdown: s.markdown,
    plain: s.plain,
    preview: previewOf(s.markdown, PREVIEW_RATIO),
    totalBlocks: s.paragraphs.length,
    totalChars: countChars(s.plain),
  };
}



export default function Converter({ locale }: { locale: Locale }) {
  const d = dicts[locale];
  const { data: session } = useSession();
  const labels: Labels = { me: d.work.me, other: d.work.them, image: d.work.image, voice: d.work.voice };
  const [mode, setMode] = useState<OutputMode>("rich");

  const [phase, setPhase] = useState<Phase>("idle");
  const [scene, setScene] = useState<Scene>("general");
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const [live, setLive] = useState<Live>({ finished: 0, total: 0, enhancing: 0, etaSec: null, markdown: "" });
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [pasteKey, setPasteKey] = useState("Ctrl V");

  const fileInput = useRef<HTMLInputElement>(null);
  const imagePane = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<Result[]>([]);
  const aiAbort = useRef(new Map<string, AbortController>());
  const phaseRef = useRef<Phase>("idle");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const result = results[active] || null;
  const busy = phase === "splitting" || phase === "processing";

  // ── client-only facts ──
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setPasteKey("⌘ V");
    try {
      if (localStorage.getItem(AI_PREF_KEY) === "0") setAiEnabled(false);
      const m = localStorage.getItem(MODE_KEY);
      if (m === "text" || m === "rich" || m === "both") setMode(m);
    } catch {}
    fetch("/api/correct")
      .then((r) => r.json())
      .then((j) => setAiAvailable(!!j.enabled))
      .catch(() => setAiAvailable(false));
  }, []);

  const mutate = useCallback((rid: string, fn: (r: Result) => Result) => {
    setResults((prev) => {
      const next = prev.map((x) => (x.rid === rid ? fn(x) : x));
      resultsRef.current = next;
      return next;
    });
  }, []);

  const saveToDb = useCallback(async (r: Result): Promise<string | undefined> => {
    const res = await fetch("/api/ocr-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullText: applyMode(r.markdown, r.figures, "text", d.work.image), preview: applyMode(r.preview, r.figures, "text", d.work.image), totalChars: r.totalChars, segmentsProcessed: r.slices }),
    });
    if (!res.ok) throw new Error(`Save failed: ${res.status}`);
    return (await res.json()).id as string | undefined;
  }, [d.work.image]);

  const patchDb = useCallback(
    async (rid: string) => {
      await new Promise((r) => setTimeout(r, 30));
      const r = resultsRef.current.find((x) => x.rid === rid);
      if (!r?.id || !r.dirty) return;
      try {
        const res = await fetch("/api/ocr-results", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: r.id, fullText: applyMode(r.markdown, r.figures, "text", d.work.image), preview: applyMode(r.preview, r.figures, "text", d.work.image), totalChars: r.totalChars }),
        });
        if (res.ok) mutate(rid, (x) => ({ ...x, dirty: false }));
      } catch {
        console.error("Failed to update OCR result");
      }
    },
    [mutate, d.work.image],
  );

  // ── Stripe return: /?paid=<id>&session_id=… ──
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const paidId = q.get("paid");
    if (!paidId || !q.get("session_id")) return;
    (async () => {
      try {
        let paid = false;
        for (let i = 0; i < 5 && !paid; i++) {
          const v = await fetch(`/api/verify-payment?ocrResultId=${paidId}`).then((r) => r.json());
          paid = !!v.paid;
          if (!paid) await new Promise((r) => setTimeout(r, 1500));
        }
        const all = await fetch("/api/ocr-results").then((r) => r.json());
        const row = Array.isArray(all) ? all.find((x: { id: string }) => x.id === paidId) : null;
        if (row) {
          const md: string = row.fullText || row.preview || "";
          const restored: Result = {
            rid: row.id,
            id: row.id,
            name: "",
            imageWidth: 0,
            imageHeight: 0,
            segments: [],
            sceneChoice: "general",
            scene: "article",
            markdown: md,
            plain: md,
            preview: row.preview || "",
            totalChars: row.totalChars || countChars(md),
            totalBlocks: md.split(/\n{2,}/).length,
            slices: row.segmentsProcessed || 0,
            failed: [],
            secs: 0,
            isPaid: paid || row.totalChars <= FREE_CHARS,
            isDownloaded: false,
            corrections: [],
            figures: [],
            describe: "idle",
            descDone: 0,
            ai: "off",
            aiDone: 0,
            aiTotal: 0,
            dirty: false,
          };
          const next = [...resultsRef.current.filter((x) => x.id !== paidId), restored];
          resultsRef.current = next;
          setResults(next);
          setActive(next.length - 1);
          setPhase("done");
        }
      } catch (e) {
        console.error("Failed to restore paid result", e);
      }
      window.history.replaceState({}, "", window.location.pathname);
    })();
  }, []);

  // Warn before leaving with an unlocked, not-yet-downloaded result
  useEffect(() => {
    if (!results.some((r) => r.isPaid && !r.isDownloaded && r.totalChars > FREE_CHARS)) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [results]);

  // ── AI proofreading ──
  const startAi = useCallback(
    async (r: Result, lines: Line[]) => {
      const candidates = pickCandidates(lines);
      if (candidates.length === 0) {
        mutate(r.rid, (x) => ({ ...x, ai: "done", aiDone: 0, aiTotal: 0 }));
        return;
      }
      const ctrl = new AbortController();
      aiAbort.current.set(r.rid, ctrl);
      mutate(r.rid, (x) => ({ ...x, ai: "running", aiDone: 0, aiTotal: candidates.length }));
      const docText = lines.map((l) => l.text).join("\n");
      const out = await runCorrections(
        candidates,
        docText,
        (done, total, found) => {
          if (ctrl.signal.aborted) return;
          mutate(r.rid, (x) => rebuild({ ...x, aiDone: done, aiTotal: total, corrections: found, dirty: x.dirty || found.length > 0 }, labels));
        },
        ctrl.signal,
      );
      aiAbort.current.delete(r.rid);
      if (ctrl.signal.aborted) return;
      if (out.status === "unavailable") {
        mutate(r.rid, (x) => rebuild({ ...x, ai: "unavailable", corrections: [] }, labels));
        return;
      }
      mutate(r.rid, (x) => rebuild({ ...x, ai: "done", corrections: out.corrections, dirty: x.dirty || out.corrections.length > 0 }, labels));
      patchDb(r.rid);
    },
    // labels only depend on the locale, which never changes on a page
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutate, patchDb],
  );

  // ── the main flow ──
  const handleFile = useCallback(
    async (file: File) => {
      if (phaseRef.current === "splitting" || phaseRef.current === "processing") return;
      if (!file.type.startsWith("image/")) {
        setError(d.upload.badFile);
        return;
      }
      const url = URL.createObjectURL(file);
      setPendingUrl(url);
      setError("");
      setPhase("splitting");
      setLive({ finished: 0, total: 0, enhancing: 0, etaSec: null, markdown: "" });
      const t0 = Date.now();
      try {
        const split = await splitImageInBrowser(file);
        setLive((l) => ({ ...l, total: split.segments.length }));
        setPhase("processing");
        const { results: segs, failed, figures: boxes } = await recognize(split.segments, (p) => {
          const preview = p.prefix.length ? structure(p.prefix, split.width, scene, labels).markdown : "";
          setLive({ finished: p.finished, total: p.total, enhancing: p.enhancing, etaSec: p.etaSec, markdown: preview });
        });
        if (failed.length === split.segments.length) throw new Error(d.work.recognitionFailed);

        const pics: Pic[] = (await cropFigures(file, boxes)).map((f) => ({ ...f, ocrText: textInside(segs, f) }));
        const final = structure(segs, split.width, scene, labels, undefined, figRefs(pics, labels.image));
        const chars = countChars(final.plain);
        const willProofread = aiEnabled && aiAvailable;
        const r: Result = {
          rid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          imageUrl: url,
          imageWidth: split.width,
          imageHeight: split.height,
          segments: segs,
          sceneChoice: scene,
          scene: final.scene,
          markdown: final.markdown,
          plain: final.plain,
          preview: previewOf(final.markdown, PREVIEW_RATIO),
          totalChars: chars,
          totalBlocks: final.paragraphs.length,
          slices: split.segments.length,
          failed,
          secs: Math.max(1, Math.round((Date.now() - t0) / 1000)),
          isPaid: chars <= FREE_CHARS,
          isDownloaded: false,
          corrections: [],
          figures: pics,
          describe: "idle",
          descDone: 0,
          ai: willProofread ? "running" : "off",
          aiDone: 0,
          aiTotal: 0,
          dirty: false,
        };
        if (session?.user) {
          try {
            r.id = await saveToDb(r);
          } catch {
            console.error("Failed to save OCR result");
          }
        }
        const next = [...resultsRef.current, r];
        resultsRef.current = next;
        setResults(next);
        setActive(next.length - 1);
        setPhase("done");
        setPendingUrl(null);
        if (willProofread) startAi(r, final.lines);
      } catch (e) {
        setError(e instanceof Error ? e.message : d.work.recognitionFailed);
        setPhase(resultsRef.current.length ? "done" : "error");
        setPendingUrl(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene, session, aiEnabled, aiAvailable, saveToDb, startAi, d],
  );

  // Paste anywhere, drop anywhere
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      for (const item of e.clipboardData?.items || []) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) handleFile(f);
          break;
        }
      }
    };
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) handleFile(f);
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFile]);

  const trySample = async (key: string) => {
    try {
      const blob = await fetch(`/samples/${d.locale}-${key}.jpg`).then((r) => r.blob());
      handleFile(new File([blob], `${key}.jpg`, { type: "image/jpeg" }));
    } catch {
      setError(d.work.recognitionFailed);
    }
  };

  // ── editing the active result ──
  const applyScene = (sc: Scene) => {
    setScene(sc);
    if (!result || result.segments.length === 0) return;
    mutate(result.rid, (x) => rebuild({ ...x, sceneChoice: sc, dirty: x.dirty || !!x.id }, labels));
    patchDb(result.rid);
  };

  const setAccepted = (pick: (c: Correction, i: number) => boolean | undefined) => {
    if (!result) return;
    mutate(result.rid, (x) =>
      rebuild(
        {
          ...x,
          dirty: true,
          corrections: x.corrections.map((c, i) => {
            const v = pick(c, i);
            return v === undefined ? c : { ...c, accepted: v };
          }),
        },
        labels,
      ),
    );
    patchDb(result.rid);
  };

  const toggleAi = () => {
    const on = !aiEnabled;
    setAiEnabled(on);
    try {
      localStorage.setItem(AI_PREF_KEY, on ? "1" : "0");
    } catch {}
    if (!result || result.segments.length === 0) return;
    if (!on) {
      aiAbort.current.get(result.rid)?.abort();
      mutate(result.rid, (x) => rebuild({ ...x, ai: "off", corrections: x.corrections.map((c) => ({ ...c, accepted: false })), dirty: true }, labels));
      patchDb(result.rid);
    } else if (result.corrections.length) {
      setAccepted(() => true);
      mutate(result.rid, (x) => ({ ...x, ai: "done" }));
    } else if (aiAvailable && (result.ai === "off" || result.ai === "unavailable")) {
      const lines = structure(result.segments, result.imageWidth, result.sceneChoice, labels).lines;
      startAi(result, lines);
    }
  };

  const scrollImageTo = (y: number) => {
    const pane = imagePane.current;
    const img = pane?.querySelector("img");
    if (!pane || !img || !result?.imageHeight) return;
    setShowImage(true);
    const target = (y / result.imageHeight) * img.clientHeight - pane.clientHeight / 3;
    pane.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  };

  const base = result ? (result.isPaid ? result.markdown : result.preview) : "";
  const visible = result ? applyMode(base, result.figures, mode, d.work.image) : "";
  const textOnly = result ? applyMode(base, result.figures, "text", d.work.image) : "";
  const display = result && result.ai !== "off" ? markCorrections(visible, result.corrections) : visible;
  const accepted = result ? result.corrections.filter((c) => c.accepted).length : 0;

  const figUrls = result ? Object.fromEntries(result.figures.map((f) => [f.id, f.url])) : {};
  const visibleFigs = result && mode !== "text" ? figureIds(visible) : [];

  const chooseMode = (m: OutputMode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {}
  };

  // Copy: Markdown text for plain editors, rich HTML (with the pictures) for docs
  const copy = async () => {
    if (!result) return;
    const plain = mode === "text" ? visible : textOnly; // plain editors always get the text-only version
    try {
      if (visibleFigs.length && typeof ClipboardItem !== "undefined") {
        const pics = result.figures.filter((f) => visibleFigs.includes(f.id));
        const html = Promise.all(pics.map(async (f) => [f.id, await toDataUrl(f.blob)] as const)).then((pairs) => {
          const urls = Object.fromEntries(pairs);
          return new Blob([toHtml(visible, (id) => urls[id])], { type: "text/html" });
        });
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([plain], { type: "text/plain" }), "text/html": html })]);
      } else {
        await navigator.clipboard.writeText(plain);
      }
    } catch {
      await navigator.clipboard.writeText(plain);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const save = (blob: Blob, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    if (result) mutate(result.rid, (x) => ({ ...x, isDownloaded: true }));
  };
  const baseName = () => (result?.name || "long2text").replace(/\.[a-z0-9]+$/i, "");

  // Download: text → .md; with pictures → a typeset, self-contained HTML page
  const download = async () => {
    if (!result) return;
    if (!visibleFigs.length) return save(new Blob([visible], { type: "text/markdown;charset=utf-8" }), `${baseName()}.md`);
    const pics = result.figures.filter((f) => visibleFigs.includes(f.id));
    const urls = Object.fromEntries(await Promise.all(pics.map(async (f) => [f.id, await toDataUrl(f.blob)] as const)));
    const html = toStyledHtml({ title: baseName(), md: visible, chat: result.scene === "chat", me: d.work.me, src: (id) => urls[id], lang: d.htmlLang });
    save(new Blob([html], { type: "text/html;charset=utf-8" }), `${baseName()}.html`);
  };

  // …or Markdown + an images/ folder
  const downloadZip = async () => {
    if (!result) return;
    const pics = result.figures.filter((f) => visibleFigs.includes(f.id));
    const files = [{ name: `${baseName()}.md`, data: new TextEncoder().encode(withImageFiles(visible)) }];
    for (const f of pics) files.push({ name: `images/${f.id}.jpg`, data: new Uint8Array(await f.blob.arrayBuffer()) });
    save(makeZip(files), `${baseName()}.zip`);
  };

  // One-line AI descriptions for the pictures (only on request: sends the crops)
  const describe = async () => {
    const r = result;
    if (!r || r.figures.length === 0) return;
    mutate(r.rid, (x) => ({ ...x, describe: "running", descDone: 0 }));
    const queue = [...r.figures];
    let done = 0;
    await Promise.all(
      Array.from({ length: Math.min(6, queue.length) }, async () => {
        while (queue.length) {
          const f = queue.shift()!;
          try {
            const image = await toDataUrl(f.blob, 384);
            const res = await fetch("/api/describe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ image, lang: d.locale }),
              signal: AbortSignal.timeout(20_000),
            });
            if (res.ok) {
              const { text } = await res.json();
              if (text) mutate(r.rid, (x) => rebuild({ ...x, figures: x.figures.map((g) => (g.id === f.id ? { ...g, desc: text } : g)), dirty: x.dirty || !!x.id }, labels));
            }
          } catch {}
          done++;
          mutate(r.rid, (x) => ({ ...x, descDone: done }));
        }
      }),
    );
    mutate(r.rid, (x) => ({ ...x, describe: "done" }));
    patchDb(r.rid);
  };

  const unlock = async () => {
    if (!result) return;
    if (!session?.user) {
      signIn("google");
      return;
    }
    try {
      setError("");
      let id = result.id;
      if (!id) {
        id = await saveToDb(result);
        mutate(result.rid, (x) => ({ ...x, id, dirty: false }));
      } else if (result.dirty) {
        await patchDb(result.rid);
      }
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ocrResultId: id, returnPath: d.home }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Checkout failed: ${res.status}`);
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    }
  };

  // Modes that need descriptions ask the vision model once per result
  useEffect(() => {
    if (mode === "rich" || !aiAvailable || !result || result.figures.length === 0 || result.describe !== "idle") return;
    describe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, aiAvailable, result?.rid, result?.describe, result?.figures.length]);

  const pick = () => {
    if (!busy) fileInput.current?.click();
  };

  const input = (
    <input
      ref={fileInput}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) handleFile(f);
        e.target.value = "";
      }}
    />
  );

  const dropOverlay = dragging && (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-accent/10 backdrop-blur-[2px]">
      <div className="rounded-2xl border-2 border-dashed border-accent bg-white/90 px-10 py-8 text-lg font-semibold text-accent shadow-xl">
        {d.upload.dropNow}
      </div>
    </div>
  );

  // ────────────────────────── idle: the hero ──────────────────────────
  if (phase === "idle" || (phase === "error" && results.length === 0)) {
    return (
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-5 pb-16 pt-10 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:pb-24">
        {input}
        {dropOverlay}
        <div className="min-w-0">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-[13px] text-muted">
            <IconLock className="h-3.5 w-3.5 text-accent" />
            {d.hero.eyebrow}
          </p>
          <h1 className="text-[36px] font-bold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[56px] sm:leading-[1.08]">
            {d.hero.title1}
            <br />
            <span className="text-accent">{d.hero.title2}</span>
          </h1>
          <p className="mt-5 max-w-[34rem] text-base leading-relaxed text-muted sm:text-[17px]">{d.hero.sub}</p>

          <div className="mt-8 max-w-[34rem] rounded-3xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(13,19,33,.05),0_12px_32px_-12px_rgba(13,19,33,.12)] sm:p-7">
            <button
              onClick={pick}
              className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-accent text-[17px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(51,85,255,.7)] transition hover:bg-accent-hover active:scale-[.99]"
            >
              <IconUpload className="h-5 w-5" />
              {d.upload.button}
            </button>
            <p className="mt-3 hidden text-center text-sm text-muted sm:block">
              {d.upload.hintBefore}{" "}
              <kbd className="rounded-md border border-line bg-wash px-1.5 py-0.5 font-mono text-[12px] text-ink">{pasteKey}</kbd>
            </p>
            <p className="mt-3 text-center text-xs text-faint sm:mt-1">{d.upload.formats}</p>
            {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}

          </div>
        </div>
        <div className="min-w-0">
          <CaseShowcase d={d} onTry={trySample} />
        </div>
      </section>
    );
  }

  // ────────────────────────── working / done ──────────────────────────
  const unit = result ? d.work.units[result.scene] : "";
  const sceneOrder: Scene[] = ["general", "chat", "meeting", "article"];

  return (
    <section className="mx-auto max-w-6xl px-5 pb-20 pt-8">
      {input}
      {dropOverlay}

      {/* top bar: results + new image */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 gap-2 overflow-x-auto">
          {results.map((r, i) => (
            <button
              key={r.rid}
              onClick={() => setActive(i)}
              title={r.name}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                i === active && !busy ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:border-faint"
              }`}
            >
              <span className="tabular-nums opacity-60">{i + 1}</span>
              <span className="max-w-[9rem] truncate">{r.plain.replace(/\s+/g, " ").slice(0, 14) || r.name}</span>
            </button>
          ))}
        </div>
        <button
          onClick={pick}
          disabled={busy}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-accent hover:text-accent disabled:opacity-40"
        >
          <IconPlus className="h-4 w-4" />
          {d.work.newImage}
        </button>
      </div>
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

      {busy ? (
        <div className="rounded-3xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(13,19,33,.05)] sm:p-7">
          <div className="flex items-center gap-5">
            <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-wash">
              {pendingUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pendingUrl} alt="" className="h-full w-full object-cover object-top" />
              )}
              <div className="l2t-scan absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-transparent via-[rgba(51,85,255,.3)] to-transparent" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold text-ink">
                {phase === "splitting" ? d.work.splitting : d.work.reading(live.finished, live.total)}
              </p>
              <p className="mt-1 text-sm text-muted">
                {live.etaSec ? d.work.eta(live.etaSec) : " "}
                {live.enhancing > 0 && <span className="ml-2 text-faint">· {d.work.zooming}</span>}
              </p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-wash">
                <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${live.total ? Math.max(4, (live.finished / live.total) * 100) : 4}%` }} />
              </div>
            </div>
          </div>
          <div className="mt-6 border-t border-line pt-5">
            {live.markdown ? (
              <div className="max-h-80 overflow-hidden [mask-image:linear-gradient(to_bottom,black_65%,transparent)]">
                <MarkdownView markdown={live.markdown} />
              </div>
            ) : (
              <p className="text-sm text-faint">{d.work.streaming}</p>
            )}
          </div>
        </div>
      ) : (
        result && (
          <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
            {/* original image */}
            {result.imageUrl && (
              <aside className="lg:sticky lg:top-20 lg:self-start">
                <button onClick={() => setShowImage((v) => !v)} className="mb-2 flex items-center gap-1.5 text-sm text-muted lg:hidden">
                  <IconImage className="h-4 w-4" />
                  {showImage ? d.work.hideOriginal : d.work.showOriginal}
                </button>
                <div className={`${showImage ? "block" : "hidden"} overflow-hidden rounded-2xl border border-line bg-wash lg:block`}>
                  <div className="flex items-center justify-between border-b border-line bg-white px-3 py-2 text-xs text-muted">
                    <span className="flex items-center gap-1.5">
                      <IconImage className="h-3.5 w-3.5" />
                      {d.work.original}
                    </span>
                    <span className="tabular-nums text-faint">
                      {result.imageWidth} × {result.imageHeight}
                    </span>
                  </div>
                  <div ref={imagePane} className="max-h-[50vh] overflow-y-auto lg:max-h-[calc(100vh-150px)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={result.imageUrl} alt={result.name} className="block w-full" />
                  </div>
                </div>
              </aside>
            )}

            <div className={`min-w-0 ${result.imageUrl ? "" : "lg:col-span-2"}`}>
              {/* toolbar */}
              <div className="mb-4 rounded-2xl border border-line bg-white p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                    <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">{d.work.detected[result.scene]}</span>
                    <span className="tabular-nums">
                      {result.totalChars} {d.work.chars}
                    </span>
                    <span className="tabular-nums">
                      {result.totalBlocks} {unit}
                    </span>
                    {result.slices > 0 && (
                      <span className="tabular-nums text-faint">
                        {result.slices} {d.work.slices}
                        {result.secs > 0 && ` · ${d.work.seconds(result.secs)}`}
                      </span>
                    )}
                    {result.failed.length > 0 && <span className="text-amber-700">{d.work.failed(result.failed.join(", "))}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={copy} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink transition hover:border-faint">
                      {copied ? <IconCheck className="h-4 w-4 text-green-600" /> : <IconCopy className="h-4 w-4" />}
                      {copied ? d.work.copied : result.isPaid ? d.work.copy : d.work.copyPreview}
                    </button>
                    <button onClick={download} className="flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-sm font-medium text-white transition hover:bg-[#1f2738]">
                      <IconDownload className="h-4 w-4" />
                      {visibleFigs.length
                        ? result.isPaid
                          ? d.work.downloadHtml
                          : d.work.downloadHtmlPreview
                        : result.isPaid
                          ? d.work.download
                          : d.work.downloadPreview}
                    </button>
                  </div>
                </div>
                {result.segments.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    <span className="mr-1 text-xs text-faint">{d.work.layout}</span>
                    <div className="flex rounded-full bg-wash p-0.5">
                      {sceneOrder.map((s) => (
                        <button
                          key={s}
                          onClick={() => applyScene(s)}
                          className={`rounded-full px-3 py-1 text-[13px] transition ${
                            result.sceneChoice === s ? "bg-white font-medium text-ink shadow-sm" : "text-muted hover:text-ink"
                          }`}
                        >
                          {d.work.scenes[s]}
                        </button>
                      ))}
                    </div>
                    {aiAvailable && (
                      <>
                        <span className="mx-1 h-4 w-px bg-line" />
                        <button
                          role="switch"
                          aria-checked={aiEnabled}
                          onClick={toggleAi}
                          className="flex items-center gap-2 rounded-full px-2 py-1 text-[13px] text-ink"
                        >
                          <span className={`relative h-5 w-9 rounded-full transition ${aiEnabled ? "bg-accent" : "bg-line"}`}>
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${aiEnabled ? "left-[18px]" : "left-0.5"}`} />
                          </span>
                          <IconSparkle className="h-3.5 w-3.5 text-accent" />
                          {d.work.ai}
                        </button>
                        {result.ai === "running" && (
                          <span className="flex items-center gap-1.5 text-xs text-muted">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                            {d.work.aiRunning(result.aiDone, result.aiTotal)}
                          </span>
                        )}
                        {result.ai === "done" && result.corrections.length === 0 && result.aiTotal > 0 && (
                          <span className="text-xs text-faint">{d.work.aiNone}</span>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* what AI restored */}
              {result.ai !== "off" && result.corrections.length > 0 && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                        <IconSparkle className="h-4 w-4 text-amber-600" />
                        {d.fix.title(result.corrections.length)}
                      </p>
                      <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">{d.fix.desc}</p>
                    </div>
                    <button
                      onClick={() => setAccepted(() => accepted === 0)}
                      className="shrink-0 rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
                    >
                      {accepted === 0 ? d.fix.allRestored : d.fix.allImage}
                    </button>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {result.corrections.map((c, i) => {
                      const { newSpan, oldSpan, p, s: tail } = changedSpan(c.original.trim(), c.corrected.trim());
                      const chars = [...c.corrected.trim()];
                      const before = chars.slice(Math.max(0, p - 6), p).join("");
                      const after = chars.slice(chars.length - tail, Math.min(chars.length, chars.length - tail + 8)).join("");
                      return (
                        <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm">
                          <button onClick={() => scrollImageTo(c.y)} className="min-w-0 truncate text-left text-muted hover:text-ink" title={c.original}>
                            <span className="text-faint">…{before}</span>
                            <del className="mx-0.5 text-faint decoration-red-400">{oldSpan || "∅"}</del>
                            <span className="text-faint">→</span>
                            <ins className={`mx-0.5 rounded px-0.5 no-underline ${c.accepted ? "bg-amber-100 font-medium text-ink" : "text-faint line-through"}`}>{newSpan || "∅"}</ins>
                            <span className="text-faint">{after}…</span>
                          </button>
                          <button
                            onClick={() => setAccepted((_, j) => (j === i ? !c.accepted : undefined))}
                            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs text-amber-800 transition hover:bg-amber-100"
                          >
                            {c.accepted && <IconUndo className="h-3.5 w-3.5" />}
                            {c.accepted ? d.fix.useImage : d.fix.useRestored}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* pictures: choose how they come out */}
              {result.figures.length > 0 && (
                <div className="mb-4 rounded-2xl border border-line bg-white px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex -space-x-2">
                      {result.figures.slice(0, 4).map((f) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={f.id} src={f.url} alt="" className="h-8 w-8 rounded-lg border-2 border-white object-cover shadow-sm" />
                      ))}
                    </span>
                    <span className="text-ink">{d.work.figuresFound(result.figures.length)}</span>
                    <span className="mx-1 hidden h-4 w-px bg-line sm:block" />
                    <span className="text-xs text-faint">{d.work.output}</span>
                    <div className="flex rounded-full bg-wash p-0.5">
                      {(["text", "rich", "both"] as OutputMode[]).map((m) => (
                        <button
                          key={m}
                          onClick={() => chooseMode(m)}
                          className={`rounded-full px-3 py-1 text-[13px] transition ${mode === m ? "bg-white font-medium text-ink shadow-sm" : "text-muted hover:text-ink"}`}
                        >
                          {d.work.modes[m]}
                        </button>
                      ))}
                    </div>
                    {result.describe === "running" && (
                      <span className="flex items-center gap-1.5 text-xs text-muted">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                        {d.work.describing(result.descDone, result.figures.length)}
                      </span>
                    )}
                    {visibleFigs.length > 0 && (
                      <button onClick={downloadZip} className="ml-auto text-xs text-muted underline-offset-4 hover:text-ink hover:underline">
                        {d.work.zipAlt}
                      </button>
                    )}
                  </div>
                  {aiAvailable && result.describe === "idle" && <p className="mt-2 text-xs text-faint">{d.work.modeHint}</p>}
                </div>
              )}

              {/* the text */}
              <div className="relative rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(13,19,33,.04)] sm:p-7">
                <MarkdownView
                  figures={figUrls}
                  captions={mode === "both"}
                  markdown={display}
                  onMark={(i) => setAccepted((_, j) => (j === i ? false : undefined))}
                  markTitle={(was) => d.fix.hover(was)}
                />
                {!result.isPaid && result.totalChars > FREE_CHARS && (
                  <div className="absolute inset-x-0 bottom-0 flex flex-col items-center rounded-b-2xl bg-gradient-to-t from-white via-white/95 to-transparent px-5 pb-8 pt-32 text-center">
                    <p className="text-lg font-semibold text-ink">{d.paywall.head(PREVIEW_PERCENT)}</p>
                    <p className="mt-1 text-sm text-muted">{d.paywall.full(result.totalChars, result.totalBlocks, unit)}</p>
                    <button
                      onClick={unlock}
                      data-ga-click={!session?.user ? "login_click" : undefined}
                      className="mt-5 flex h-12 items-center gap-2 rounded-full bg-accent px-7 text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(51,85,255,.7)] transition hover:bg-accent-hover"
                    >
                      <IconLock className="h-4 w-4" />
                      {session?.user ? d.paywall.unlock : d.paywall.signInUnlock}
                    </button>
                    <p className="mt-3 text-xs text-faint">{d.paywall.fine}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      )}
    </section>
  );
}
