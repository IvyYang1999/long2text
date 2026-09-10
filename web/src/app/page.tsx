"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { splitImageInBrowser } from "@/lib/client-splitter";
import { structure, previewOf, type SegmentResult, type Scene, type DetectedScene, type OCRBlock } from "@/lib/structure";
import MarkdownView from "@/components/MarkdownView";

export default function Page() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}

type Lang = "ch" | "en";
type Status = "idle" | "splitting" | "processing" | "done" | "error";

const FREE_CHARS = 500;
const PREVIEW_RATIO = 0.3;

interface OCRResult {
  id?: string; // database id (if saved)
  name: string; // file name
  imageWidth: number;
  segments: SegmentResult[]; // kept so the scene can be re-applied without re-OCR
  scene: DetectedScene; // scene actually used for formatting
  markdown: string;
  plain: string;
  preview: string;
  total_chars: number;
  total_blocks: number; // paragraphs / messages
  segments_processed: number;
  failed_segments: number[];
  isPaid: boolean;
  isDownloaded: boolean;
}

interface LiveState {
  current: number;
  total: number;
  etaSec: number | null;
  markdown: string;
  scene: DetectedScene | null;
}

const T = {
  ch: {
    me: "我",
    other: "对方",
    scenes: { general: "自动", chat: "聊天记录", meeting: "会议记录", article: "文章/长文" } as Record<Scene, string>,
    sceneDetected: { chat: "聊天记录", meeting: "会议记录", article: "文章" } as Record<DetectedScene, string>,
    units: { chat: "条消息", meeting: "段发言", article: "个段落" } as Record<DetectedScene, string>,
  },
  en: {
    me: "Me",
    other: "Them",
    scenes: { general: "Auto", chat: "Chat", meeting: "Meeting", article: "Article" } as Record<Scene, string>,
    sceneDetected: { chat: "chat", meeting: "meeting", article: "article" } as Record<DetectedScene, string>,
    units: { chat: "messages", meeting: "speeches", article: "paragraphs" } as Record<DetectedScene, string>,
  },
};

function Home() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<Status>("idle");
  const [scene, setScene] = useState<Scene>("general");
  const [lang, setLang] = useState<Lang>("ch");
  const [results, setResults] = useState<OCRResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [live, setLive] = useState<LiveState>({ current: 0, total: 0, etaSec: null, markdown: "", scene: null });
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<OCRResult[]>([]);
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  // Pick UI language from the browser on first load
  useEffect(() => {
    // Browser language is only known on the client; one-time sync after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (typeof navigator !== "undefined" && !/^zh/i.test(navigator.language)) setLang("en");
  }, []);

  const t = T[lang];
  const result = results[activeIndex] || null;
  const busy = status === "splitting" || status === "processing";

  // ── Stripe success callback: reload the paid result from the DB ──
  useEffect(() => {
    const paidResultId = searchParams.get("paid");
    const sessionId = searchParams.get("session_id");
    if (!paidResultId || !sessionId) return;

    (async () => {
      try {
        let paid = false;
        for (let i = 0; i < 5; i++) {
          const verifyRes = await fetch(`/api/verify-payment?ocrResultId=${paidResultId}`);
          const verifyData = await verifyRes.json();
          if (verifyData.paid) {
            paid = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 1500));
        }
        const res = await fetch("/api/ocr-results");
        const allResults = await res.json();
        const dbResult = allResults.find((r: { id: string }) => r.id === paidResultId);
        if (dbResult) {
          const markdown: string = dbResult.fullText || dbResult.preview || "";
          const restored: OCRResult = {
            id: dbResult.id,
            name: "",
            imageWidth: 0,
            segments: [],
            scene: "article",
            markdown,
            plain: markdown,
            preview: dbResult.preview || "",
            total_chars: dbResult.totalChars || markdown.length,
            total_blocks: markdown.split(/\n{2,}/).length,
            segments_processed: dbResult.segmentsProcessed || 0,
            failed_segments: [],
            isPaid: paid || dbResult.totalChars <= FREE_CHARS,
            isDownloaded: false,
          };
          const current = resultsRef.current;
          const exists = current.some((r) => r.id === paidResultId);
          const next = exists ? current.map((r) => (r.id === paidResultId ? restored : r)) : [...current, restored];
          setResults(next);
          setActiveIndex(Math.max(0, next.findIndex((r) => r.id === paidResultId)));
          setStatus("done");
        }
      } catch (err) {
        console.error("Failed to restore paid result:", err);
      }
      window.history.replaceState({}, "", "/");
    })();
  }, [searchParams]);

  // Warn before leaving with an un-downloaded paid result
  useEffect(() => {
    const hasUndownloaded = results.some((r) => !r.isDownloaded && r.isPaid && r.total_chars > FREE_CHARS);
    if (!hasUndownloaded) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [results]);

  const saveToDb = useCallback(async (r: OCRResult): Promise<string | undefined> => {
    const saveRes = await fetch("/api/ocr-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullText: r.markdown,
        preview: r.preview,
        totalChars: r.total_chars,
        segmentsProcessed: r.segments_processed,
      }),
    });
    if (!saveRes.ok) throw new Error(`Save failed: ${saveRes.status}`);
    const saveData = await saveRes.json();
    return saveData.id as string | undefined;
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (busy) return;
      if (!file.type.startsWith("image/")) {
        setError(lang === "ch" ? "请上传图片文件（PNG、JPG、WEBP）" : "Please upload an image file (PNG, JPG, WEBP)");
        return;
      }

      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setStatus("splitting");
      setError("");
      setLive({ current: 0, total: 0, etaSec: null, markdown: "", scene: null });
      const labels = { me: t.me, other: t.other };

      try {
        // 1. Split in the browser
        const splitInfo = await splitImageInBrowser(file);
        const { segments, width } = splitInfo;
        setLive({ current: 0, total: segments.length, etaSec: null, markdown: "", scene: null });
        setStatus("processing");

        // 2. OCR each segment (Tencent free tier ≈ 1 QPS, so sequential)
        const done: SegmentResult[] = [];
        const failed: number[] = [];
        const started = Date.now();
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          let blocks: OCRBlock[] | null = null;
          let lastError = "";
          for (let attempt = 0; attempt < 3 && !blocks; attempt++) {
            if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt));
            try {
              const formData = new FormData();
              formData.append("file", seg.blob, `segment-${seg.index}.jpg`);
              const res = await fetch("/api/ocr", { method: "POST", body: formData });
              const data = await res.json().catch(() => ({}));
              if (!res.ok || !data.success) {
                lastError = data.detail || `HTTP ${res.status}`;
                continue;
              }
              blocks = (data.blocks || []) as OCRBlock[];
            } catch (e) {
              lastError = e instanceof Error ? e.message : "Network error";
            }
          }
          if (!blocks) {
            console.error(`[OCR] segment ${i + 1} failed: ${lastError}`);
            failed.push(i + 1);
            blocks = [];
          }
          done.push({ index: seg.index, yStart: seg.yStart, yEnd: seg.yEnd, blocks });

          // 3. Progressive structuring so the user sees text while waiting
          const elapsed = (Date.now() - started) / 1000;
          const perSeg = elapsed / (i + 1);
          const partial = structure(done, width, scene, labels);
          setLive({
            current: i + 1,
            total: segments.length,
            etaSec: i + 1 < segments.length ? Math.ceil(perSeg * (segments.length - i - 1)) : 0,
            markdown: partial.markdown,
            scene: partial.scene,
          });
          if (i < segments.length - 1) await new Promise((r) => setTimeout(r, 100));
        }

        if (failed.length === segments.length) {
          throw new Error(lang === "ch" ? "识别失败，请稍后重试" : "Recognition failed, please try again");
        }

        // 4. Final structure
        const final = structure(done, width, scene, labels);
        const newResult: OCRResult = {
          name: file.name,
          imageWidth: width,
          segments: done,
          scene: final.scene,
          markdown: final.markdown,
          plain: final.plain,
          preview: previewOf(final.markdown, PREVIEW_RATIO),
          total_chars: final.plain.replace(/\s/g, "").length,
          total_blocks: final.paragraphs.length,
          segments_processed: segments.length,
          failed_segments: failed,
          isPaid: final.plain.replace(/\s/g, "").length <= FREE_CHARS,
          isDownloaded: false,
        };

        if (session?.user) {
          try {
            newResult.id = await saveToDb(newResult);
          } catch {
            console.error("Failed to save OCR result to database");
          }
        }

        const next = [...resultsRef.current, newResult];
        setResults(next);
        setActiveIndex(next.length - 1);
        setStatus("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      }
    },
    [busy, lang, scene, session, t.me, t.other, saveToDb],
  );

  // Re-apply a scene to the active result (no OCR needed — blocks are kept)
  const applyScene = (s: Scene) => {
    setScene(s);
    if (!result || result.segments.length === 0) return;
    const r = structure(result.segments, result.imageWidth, s, { me: t.me, other: t.other });
    setResults((prev) =>
      prev.map((x, i) =>
        i === activeIndex
          ? {
              ...x,
              scene: r.scene,
              markdown: r.markdown,
              plain: r.plain,
              preview: previewOf(r.markdown, PREVIEW_RATIO),
              total_blocks: r.paragraphs.length,
            }
          : x,
      ),
    );
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      for (const item of e.clipboardData.items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    },
    [handleFile],
  );

  const visibleMarkdown = result ? (result.isPaid ? result.markdown : result.preview) : "";

  const copyToClipboard = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(visibleMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadMarkdown = () => {
    if (!result) return;
    const blob = new Blob([visibleMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (result.name || "long2text").replace(/\.[a-z]+$/i, "") + ".md";
    a.click();
    URL.revokeObjectURL(url);
    setResults((prev) => prev.map((r, i) => (i === activeIndex ? { ...r, isDownloaded: true } : r)));
  };

  const handleUnlock = async () => {
    if (!result) return;
    if (!session?.user) {
      signIn("google");
      return;
    }
    try {
      setError("");
      let resultId = result.id;
      if (!resultId) {
        resultId = await saveToDb(result);
        setResults((prev) => prev.map((r, i) => (i === activeIndex ? { ...r, id: resultId } : r)));
      }
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ocrResultId: resultId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Checkout failed: ${res.status}`);
      }
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error("Unlock error:", err);
      setError(err instanceof Error ? err.message : "Payment failed");
    }
  };

  const openPicker = () => {
    if (!busy) fileInputRef.current?.click();
  };

  const sceneOrder: Scene[] = ["general", "chat", "meeting", "article"];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white" onPaste={handlePaste}>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">L2T</div>
            <span className="text-lg font-semibold text-slate-900">Long2Text</span>
          </div>
          <nav className="flex items-center gap-2 text-sm text-slate-600 sm:gap-4">
            <button onClick={() => setLang(lang === "ch" ? "en" : "ch")} className="rounded-md px-2 py-1 hover:bg-slate-100">
              {lang === "ch" ? "EN" : "中文"}
            </button>
            {session?.user ? (
              <>
                <Link href="/history" className="rounded-md px-2 py-1 hover:bg-slate-100">
                  {lang === "ch" ? "历史记录" : "History"}
                </Link>
                <div className="flex items-center gap-2">
                  {session.user.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={session.user.image} alt="" className="h-7 w-7 rounded-full" />
                  )}
                  <span className="hidden max-w-[120px] truncate text-sm sm:inline">{session.user.name}</span>
                  <button onClick={() => signOut()} className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                    {lang === "ch" ? "退出" : "Sign out"}
                  </button>
                </div>
              </>
            ) : (
              <button onClick={() => signIn("google")} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                {lang === "ch" ? "Google 登录" : "Sign in with Google"}
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Hero — full when nothing has happened yet, compact afterwards */}
        {results.length === 0 && status === "idle" ? (
          <section className="mb-10 text-center">
            <h1 className="mb-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              {lang === "ch" ? (
                <>
                  长截图 → 带结构的<span className="text-indigo-600">文字</span>
                </>
              ) : (
                <>
                  Long screenshot → <span className="text-indigo-600">structured</span> text
                </>
              )}
            </h1>
            <p className="mx-auto max-w-2xl text-base text-slate-600 sm:text-lg">
              {lang === "ch"
                ? "微信聊天、会议纪要、长文章截图，识别后自动合并段落、标出说话人和时间，输出可直接粘贴的 Markdown。"
                : "Chat logs, meeting notes, long articles: recognized, merged into paragraphs, speakers and timestamps marked, exported as Markdown you can paste anywhere."}
            </p>
          </section>
        ) : null}

        {/* Scene selector */}
        <section className="mb-4 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-slate-400">{lang === "ch" ? "排版方式" : "Layout"}</span>
          {sceneOrder.map((s) => (
            <button
              key={s}
              onClick={() => applyScene(s)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                scene === s ? "bg-indigo-600 text-white shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t.scenes[s]}
            </button>
          ))}
        </section>

        {/* Upload zone */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        {status === "done" && result ? (
          <section
            className={`mb-6 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 text-sm transition-all ${
              dragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-white hover:border-indigo-400"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={openPicker}
          >
            <span className="text-slate-600">
              <span className="mr-2 font-semibold text-indigo-600">＋</span>
              {lang === "ch" ? "转换另一张图片（点击、拖拽或 Ctrl+V 粘贴）" : "Convert another image (click, drop, or paste)"}
            </span>
            {error && <span className="text-red-500">{error}</span>}
          </section>
        ) : busy ? (
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              {previewUrl && (
                <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="" className="h-full w-full object-cover object-top" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800">
                  {status === "splitting"
                    ? lang === "ch"
                      ? "正在切分图片…"
                      : "Splitting image…"
                    : lang === "ch"
                      ? `正在识别第 ${live.current + 1 > live.total ? live.total : live.current + 1} / ${live.total} 段`
                      : `Recognizing segment ${Math.min(live.current + 1, live.total)} / ${live.total}`}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {live.etaSec !== null && live.etaSec > 0
                    ? lang === "ch"
                      ? `预计还需 ${live.etaSec} 秒 · 识别引擎限 1 段/秒，长图请稍候`
                      : `About ${live.etaSec}s left · the OCR engine allows 1 segment/s`
                    : lang === "ch"
                      ? "长图会被切成多段逐段识别，识别到的内容会实时显示在下方"
                      : "Long images are split into segments; recognized text appears below as it arrives"}
                </p>
                {live.total > 0 && (
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-indigo-600 transition-all duration-300" style={{ width: `${(live.current / live.total) * 100}%` }} />
                  </div>
                )}
              </div>
            </div>
            {live.markdown && (
              <div className="mt-5 max-h-80 overflow-hidden border-t border-slate-100 pt-4 [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">
                <MarkdownView markdown={live.markdown} />
              </div>
            )}
          </section>
        ) : (
          <section
            className={`mb-8 cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all sm:p-14 ${
              dragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-slate-300"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={openPicker}
          >
            <div className="mb-4 text-5xl">📸</div>
            <p className="mb-2 text-lg font-medium text-slate-700">
              {lang === "ch" ? "拖拽长截图到这里，或点击上传" : "Drop your long screenshot here, or click to upload"}
            </p>
            <p className="text-sm text-slate-400">{lang === "ch" ? "也可以直接 Ctrl+V 粘贴截图 · PNG / JPG / WEBP · 图片不会被保存" : "Or paste with Ctrl+V · PNG / JPG / WEBP · images are never stored"}</p>
            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          </section>
        )}

        {/* Results */}
        {result && (status === "done" || results.length > 0) && !busy && (
          <section className="mb-16">
            {results.length > 1 && (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {results.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIndex(i)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition-all ${
                      i === activeIndex ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                    title={r.name}
                  >
                    <span className="font-medium">{i + 1}.</span> {r.plain.replace(/\s+/g, " ").slice(0, 12)}…{r.isPaid && r.total_chars > FREE_CHARS && " ✓"}
                  </button>
                ))}
              </div>
            )}

            {/* Stats bar */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 sm:px-6">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {lang === "ch" ? `识别为${t.sceneDetected[result.scene]}` : `Detected: ${t.sceneDetected[result.scene]}`}
                </span>
                <span>
                  {result.total_chars} {lang === "ch" ? "字" : "chars"}
                </span>
                <span>
                  {result.total_blocks} {t.units[result.scene]}
                </span>
                <span>
                  {result.segments_processed} {lang === "ch" ? "段" : "segments"}
                </span>
                {result.failed_segments.length > 0 && (
                  <span className="text-amber-600">
                    {lang === "ch" ? `第 ${result.failed_segments.join("、")} 段识别失败` : `Segment ${result.failed_segments.join(", ")} failed`}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={copyToClipboard} className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300">
                  {copied ? (lang === "ch" ? "已复制" : "Copied") : result.isPaid ? (lang === "ch" ? "复制 Markdown" : "Copy Markdown") : lang === "ch" ? "复制预览" : "Copy preview"}
                </button>
                <button onClick={downloadMarkdown} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                  {result.isPaid ? (lang === "ch" ? "下载 .md" : "Download .md") : lang === "ch" ? "下载预览 .md" : "Download preview"}
                </button>
              </div>
            </div>

            {/* Text result */}
            <div className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <MarkdownView markdown={visibleMarkdown} />

              {/* Paywall */}
              {!result.isPaid && result.total_chars > FREE_CHARS && (
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center rounded-b-xl bg-gradient-to-t from-white via-white/95 to-transparent px-4 pb-8 pt-28">
                  <p className="mb-1 text-center text-lg font-semibold text-slate-800">
                    {lang === "ch"
                      ? `以上是前 ${Math.round(PREVIEW_RATIO * 100)}%，全文共 ${result.total_chars} 字、${result.total_blocks} ${t.units[result.scene]}`
                      : `That's the first ${Math.round(PREVIEW_RATIO * 100)}% — full result: ${result.total_chars} chars, ${result.total_blocks} ${t.units[result.scene]}`}
                  </p>
                  <p className="mb-4 text-center text-sm text-slate-500">
                    {lang === "ch" ? "已合并段落、标出说话人和时间；解锁后可复制、下载 Markdown，并保存到历史记录" : "Paragraphs merged, speakers and timestamps marked. Unlock to copy, download Markdown, and keep it in your history"}
                  </p>
                  <button onClick={handleUnlock} className="rounded-xl bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-lg transition-all hover:bg-indigo-700 hover:shadow-xl">
                    {!session?.user ? (lang === "ch" ? "登录后解锁 · $0.99" : "Sign in to unlock · $0.99") : lang === "ch" ? "解锁全文 · $0.99" : "Unlock full result · $0.99"}
                  </button>
                  {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
                  <p className="mt-2 text-xs text-slate-400">{lang === "ch" ? "单张图片一次性购买 · Stripe 安全支付" : "One-time purchase per image · Secure payment by Stripe"}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Features */}
        <section className="mb-16 grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: "🧩",
              title: lang === "ch" ? "切分后无缝合并" : "Split, then merged seamlessly",
              desc: lang === "ch" ? "超长图自动切段识别，按位置去重，切口处不丢字、不重复" : "Ultra-long images are recognized in segments and de-duplicated by position, so seams lose nothing",
            },
            {
              icon: "💬",
              title: lang === "ch" ? "还原段落与说话人" : "Paragraphs and speakers restored",
              desc: lang === "ch" ? "换行合并成自然段；聊天记录标出谁说的、什么时候说的" : "Visual line breaks become paragraphs; chats get speaker and timestamp labels",
            },
            {
              icon: "📝",
              title: lang === "ch" ? "真正的 Markdown" : "Real Markdown",
              desc: lang === "ch" ? "标题、说话人、时间戳、列表都是 Markdown 标记，直接粘进笔记" : "Headings, speakers, timestamps and lists as Markdown, ready to paste into your notes",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-3 text-3xl">{f.icon}</div>
              <h3 className="mb-2 font-semibold text-slate-900">{f.title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* Pricing */}
        <section id="pricing" className="mb-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">{lang === "ch" ? "简单定价" : "Simple pricing"}</h2>
          <div className="mx-auto grid max-w-2xl gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-white p-6">
              <h3 className="mb-1 text-lg font-semibold text-slate-900">{lang === "ch" ? "免费" : "Free"}</h3>
              <p className="mb-4 text-2xl font-bold text-indigo-600">$0</p>
              <ul className="space-y-2">
                {(lang === "ch"
                  ? ["不限次数", `${FREE_CHARS} 字以内的图片：完整结果`, `更长的图片：前 ${Math.round(PREVIEW_RATIO * 100)}%（已排版）预览`]
                  : ["Unlimited conversions", `Full result for images under ${FREE_CHARS} chars`, `First ${Math.round(PREVIEW_RATIO * 100)}% (formatted) for longer images`]
                ).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="text-green-500">&#10003;</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6 shadow-md">
              <h3 className="mb-1 text-lg font-semibold text-slate-900">{lang === "ch" ? "解锁全文" : "Unlock full result"}</h3>
              <p className="mb-4 text-2xl font-bold text-indigo-600">$0.99</p>
              <ul className="space-y-2">
                {(lang === "ch"
                  ? ["单张图片全文，按次购买，无订阅", "复制 / 下载 Markdown", "保存在历史记录，随时找回"]
                  : ["Full result for one image, no subscription", "Copy / download Markdown", "Kept in your history"]
                ).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="text-green-500">&#10003;</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">{lang === "ch" ? "常见问题" : "FAQ"}</h2>
          <div className="mx-auto max-w-3xl space-y-4">
            {(lang === "ch"
              ? [
                  ["支持多长的截图？", "没有上限。图片在你的浏览器里被切成多段，逐段识别后按位置合并，切口处不会丢字。上百段的超长图也能处理，只是需要多等一会儿。"],
                  ["「排版方式」是做什么的？", "自动模式会根据版面判断是聊天记录、会议记录还是文章。聊天记录会标出说话人和时间；文章会识别标题并合并段落。识别完成后可以随时切换，不需要重新上传。"],
                  ["为什么长图要等这么久？", "识别引擎限制每秒 1 段。识别到的内容会实时显示，不用等全部完成。"],
                  ["支持哪些语言？", "中文、英文以及中英混排效果最好，其他语言有基本支持。"],
                  ["我的图片安全吗？", "图片只在识别过程中经过服务器，不会被保存。登录后识别出的文字会保存在你的历史记录里，只有你能看到。"],
                  ["免费和付费的区别？", `${FREE_CHARS} 字以内的图片完全免费。更长的图片免费看前 ${Math.round(PREVIEW_RATIO * 100)}%，付 $0.99 解锁这一张的全文。`],
                ]
              : [
                  ["How long can the screenshot be?", "No limit. The image is split in your browser, each segment is recognized, and the pieces are merged by position so nothing is lost at the seams."],
                  ["What does “Layout” do?", "Auto detects whether the image is a chat, a meeting transcript, or an article. Chats get speaker and timestamp labels; articles get headings and merged paragraphs. You can switch after recognition without re-uploading."],
                  ["Why does a long image take a while?", "The OCR engine allows one segment per second. Recognized text is shown as it arrives, so you don't have to wait for the end."],
                  ["Which languages are supported?", "Chinese, English and mixed text work best; other languages have basic support."],
                  ["Is my image safe?", "Images pass through the server only during recognition and are never stored. If you sign in, the recognized text is kept in your private history."],
                  ["Free vs paid?", `Images under ${FREE_CHARS} characters are free. Longer images show the first ${Math.round(PREVIEW_RATIO * 100)}% for free; $0.99 unlocks the full result for that image.`],
                ]
            ).map(([q, a]) => (
              <details key={q} className="group rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-6 py-4 text-sm font-medium text-slate-900 hover:bg-slate-50">{q}</summary>
                <p className="px-6 pb-4 text-sm leading-relaxed text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 bg-white py-8">
        <div className="mx-auto max-w-5xl px-6 text-center text-sm text-slate-400">
          <p>&copy; 2026 Long2Text. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
