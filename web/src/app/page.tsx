"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { splitImageInBrowser } from "@/lib/client-splitter";

type Scene = "general" | "chat" | "meeting" | "article";
type Lang = "ch" | "en";
type Status = "idle" | "splitting" | "processing" | "done" | "error";

interface OCRResult {
  id?: string; // database id (if saved)
  full_text: string;
  preview: string;
  total_chars: number;
  total_lines: number;
  segments_processed: number;
  isPaid: boolean;
  isDownloaded: boolean;
}

export default function Home() {
  const { data: session, status: authStatus } = useSession();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<Status>("idle");
  const [scene, setScene] = useState<Scene>("general");
  const [lang, setLang] = useState<Lang>("ch");
  const [results, setResults] = useState<OCRResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const result = results[activeIndex] || null;

  // Handle Stripe success callback
  useEffect(() => {
    const paidResultId = searchParams.get("paid");
    const sessionId = searchParams.get("session_id");
    if (paidResultId && sessionId) {
      // Verify payment and mark as paid
      fetch(`/api/verify-payment?ocrResultId=${paidResultId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.paid) {
            setResults((prev) =>
              prev.map((r) =>
                r.id === paidResultId ? { ...r, isPaid: true } : r,
              ),
            );
          }
        });
      // Clean URL
      window.history.replaceState({}, "", "/");
    }
  }, [searchParams]);

  // beforeunload warning for undownloaded results
  useEffect(() => {
    const hasUndownloaded = results.some((r) => !r.isDownloaded && r.isPaid);
    if (!hasUndownloaded) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [results]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file (PNG, JPG, WEBP)");
        return;
      }

      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setStatus("splitting");
      setError("");
      setProgress({ current: 0, total: 0 });

      try {
        // Step 1: Split image in browser
        const splitInfo = await splitImageInBrowser(file);
        const { segments } = splitInfo;
        setProgress({ current: 0, total: segments.length });
        setStatus("processing");

        // Step 2: Upload each segment and collect OCR results
        const segmentTexts: string[] = [];
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          const formData = new FormData();
          formData.append(
            "file",
            seg.blob,
            `segment-${seg.index}.jpg`,
          );

          const res = await fetch("/api/ocr", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            throw new Error(`Segment ${i + 1} failed: ${res.status}`);
          }

          const data = await res.json();
          if (!data.success) {
            throw new Error(data.detail || `Segment ${i + 1} failed`);
          }

          segmentTexts.push(data.text);
          setProgress({ current: i + 1, total: segments.length });
        }

        // Step 3: Merge segment texts
        const fullText = mergeSegmentTexts(segmentTexts);
        const lines = fullText.split("\n");
        const preview = lines
          .slice(0, Math.max(5, Math.ceil(lines.length * 0.2)))
          .join("\n");

        const newResult: OCRResult = {
          full_text: fullText,
          preview,
          total_chars: fullText.length,
          total_lines: lines.length,
          segments_processed: segments.length,
          isPaid: fullText.length <= 500, // free if short
          isDownloaded: false,
        };

        // Save to database if logged in
        if (session?.user) {
          try {
            const saveRes = await fetch("/api/ocr-results", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fullText,
                preview,
                totalChars: fullText.length,
                segmentsProcessed: segments.length,
              }),
            });
            const saveData = await saveRes.json();
            if (saveData.id) {
              newResult.id = saveData.id;
            }
          } catch {
            // Non-critical: continue even if save fails
            console.error("Failed to save OCR result to database");
          }
        }

        setResults((prev) => [...prev, newResult]);
        setActiveIndex((prev) => (prev === 0 && results.length === 0 ? 0 : results.length));
        setStatus("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      }
    },
    [lang, scene, session, results.length],
  );

  function mergeSegmentTexts(texts: string[]): string {
    if (texts.length === 0) return "";
    if (texts.length === 1) return texts[0].trim();

    let merged = texts[0].trim();
    for (let i = 1; i < texts.length; i++) {
      const current = texts[i].trim();
      if (!current) continue;

      const prevLines = merged.split("\n");
      const currLines = current.split("\n");

      let bestOverlap = 0;
      const maxCheck = Math.min(prevLines.length, currLines.length, 8);
      for (let n = 1; n <= maxCheck; n++) {
        const prevTail = prevLines
          .slice(-n)
          .map((l) => l.trim())
          .join("\n");
        const currHead = currLines
          .slice(0, n)
          .map((l) => l.trim())
          .join("\n");
        if (prevTail === currHead) {
          bestOverlap = n;
        }
      }

      const newLines = currLines.slice(bestOverlap);
      if (newLines.length > 0) {
        merged += "\n" + newLines.join("\n");
      }
    }
    return merged;
  }

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
      const items = e.clipboardData.items;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    },
    [handleFile],
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleUnlock = async () => {
    if (!result) return;

    // Not logged in → trigger Google sign in
    if (!session?.user) {
      signIn("google");
      return;
    }

    // No database ID → need to save first
    let resultId = result.id;
    if (!resultId) {
      const saveRes = await fetch("/api/ocr-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullText: result.full_text,
          preview: result.preview,
          totalChars: result.total_chars,
          segmentsProcessed: result.segments_processed,
        }),
      });
      const saveData = await saveRes.json();
      resultId = saveData.id;
      setResults((prev) =>
        prev.map((r, i) => (i === activeIndex ? { ...r, id: resultId } : r)),
      );
    }

    // Create checkout session
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ocrResultId: resultId }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
  };

  const markDownloaded = () => {
    setResults((prev) =>
      prev.map((r, i) =>
        i === activeIndex ? { ...r, isDownloaded: true } : r,
      ),
    );
  };

  const scenes: { value: Scene; label: string; labelEn: string }[] = [
    { value: "general", label: "通用", labelEn: "General" },
    { value: "chat", label: "聊天记录", labelEn: "Chat" },
    { value: "meeting", label: "会议记录", labelEn: "Meeting" },
    { value: "article", label: "文章/长文", labelEn: "Article" },
  ];

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-slate-50 to-white"
      onPaste={handlePaste}
    >
      {/* Header */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              L2T
            </div>
            <span className="text-lg font-semibold text-slate-900">
              Long2Text
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm text-slate-600">
            <button
              onClick={() => setLang(lang === "ch" ? "en" : "ch")}
              className="rounded-md px-3 py-1 hover:bg-slate-100"
            >
              {lang === "ch" ? "EN" : "中文"}
            </button>
            {session?.user ? (
              <>
                <a
                  href="/history"
                  className="rounded-md px-3 py-1 hover:bg-slate-100"
                >
                  {lang === "ch" ? "历史记录" : "History"}
                </a>
                <div className="flex items-center gap-2">
                  {session.user.image && (
                    <img
                      src={session.user.image}
                      alt=""
                      className="h-7 w-7 rounded-full"
                    />
                  )}
                  <span className="max-w-[120px] truncate text-sm">
                    {session.user.name}
                  </span>
                  <button
                    onClick={() => signOut()}
                    className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    {lang === "ch" ? "退出" : "Sign out"}
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => signIn("google")}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                {lang === "ch" ? "Google 登录" : "Sign in with Google"}
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Hero */}
        <section className="mb-16 text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            {lang === "ch" ? (
              <>
                长截图转文字
                <span className="text-indigo-600">专家</span>
              </>
            ) : (
              <>
                Long Screenshot to Text{" "}
                <span className="text-indigo-600">Expert</span>
              </>
            )}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            {lang === "ch"
              ? "上传长截图，一键转换为格式化文字。支持聊天记录、会议转写、长文章，输出 Markdown 格式。"
              : "Upload long screenshots, convert to formatted text instantly. Chat records, meeting transcripts, articles. Markdown output."}
          </p>
        </section>

        {/* Scene Selector */}
        <section className="mb-6 flex flex-wrap justify-center gap-2">
          {scenes.map((s) => (
            <button
              key={s.value}
              onClick={() => setScene(s.value)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                scene === s.value
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {lang === "ch" ? s.label : s.labelEn}
            </button>
          ))}
        </section>

        {/* Upload Zone */}
        <section
          className={`mb-8 rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
            dragActive
              ? "border-indigo-500 bg-indigo-50"
              : "border-slate-200 bg-white hover:border-slate-300"
          } ${status === "idle" || status === "error" || status === "done" ? "cursor-pointer" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() =>
            (status === "idle" || status === "error" || status === "done") &&
            fileInputRef.current?.click()
          }
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          {status === "idle" || status === "error" ? (
            <>
              <div className="mb-4 text-5xl">📸</div>
              <p className="mb-2 text-lg font-medium text-slate-700">
                {lang === "ch"
                  ? "拖拽长截图到这里，或点击上传"
                  : "Drop your long screenshot here, or click to upload"}
              </p>
              <p className="text-sm text-slate-400">
                {lang === "ch"
                  ? "也可以直接 Ctrl+V 粘贴截图 | 支持 PNG, JPG, WEBP"
                  : "Or paste with Ctrl+V | PNG, JPG, WEBP supported"}
              </p>
              {error && (
                <p className="mt-4 text-sm text-red-500">{error}</p>
              )}
            </>
          ) : status === "splitting" ? (
            <div className="flex flex-col items-center">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
              <p className="text-lg font-medium text-slate-700">
                {lang === "ch" ? "正在切分图片..." : "Splitting image..."}
              </p>
              <p className="text-sm text-slate-400">
                {lang === "ch"
                  ? "在浏览器中智能切分长图"
                  : "Smart splitting in your browser"}
              </p>
            </div>
          ) : status === "processing" ? (
            <div className="flex flex-col items-center">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
              <p className="text-lg font-medium text-slate-700">
                {lang === "ch"
                  ? `正在识别中 (${progress.current}/${progress.total})...`
                  : `Recognizing (${progress.current}/${progress.total})...`}
              </p>
              {progress.total > 0 && (
                <div className="mt-3 h-2 w-64 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                    style={{
                      width: `${(progress.current / progress.total) * 100}%`,
                    }}
                  />
                </div>
              )}
              <p className="mt-2 text-sm text-slate-400">
                {lang === "ch"
                  ? "逐段识别后智能合并"
                  : "Recognizing each segment, then merging"}
              </p>
            </div>
          ) : status === "done" ? (
            <>
              <div className="mb-2 text-3xl">📸</div>
              <p className="text-sm font-medium text-slate-500">
                {lang === "ch"
                  ? "点击或拖拽上传另一张图片"
                  : "Click or drop to convert another image"}
              </p>
            </>
          ) : null}
        </section>

        {/* Image Preview */}
        {previewUrl && (status === "splitting" || status === "processing") && (
          <section className="mb-8 flex justify-center">
            <div className="max-h-64 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
              <img
                src={previewUrl}
                alt="Uploaded screenshot"
                className="h-full max-h-64 w-auto object-cover object-top"
              />
            </div>
          </section>
        )}

        {/* Results tabs (when multiple) */}
        {results.length > 1 && (
          <section className="mb-4 flex gap-2 overflow-x-auto">
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  i === activeIndex
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {lang === "ch" ? `结果 ${i + 1}` : `Result ${i + 1}`}
                {r.isPaid && " ✓"}
              </button>
            ))}
          </section>
        )}

        {/* Results */}
        {result && (status === "done" || results.length > 0) && (
          <section className="mb-16">
            {/* Stats bar */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-50 px-6 py-3">
              <div className="flex gap-6 text-sm text-slate-500">
                <span>
                  {result.total_chars}{" "}
                  {lang === "ch" ? "字" : "chars"}
                </span>
                <span>
                  {result.total_lines}{" "}
                  {lang === "ch" ? "行" : "lines"}
                </span>
                <span>
                  {result.segments_processed}{" "}
                  {lang === "ch" ? "段处理" : "segments"}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const text = result.isPaid
                      ? result.full_text
                      : result.preview;
                    copyToClipboard(text);
                  }}
                  className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
                >
                  {lang === "ch" ? "复制文字" : "Copy Text"}
                </button>
                <button
                  onClick={() => {
                    const text = result.isPaid
                      ? result.full_text
                      : result.preview;
                    const blob = new Blob([text], { type: "text/markdown" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "long2text-result.md";
                    a.click();
                    markDownloaded();
                  }}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {lang === "ch" ? "下载 Markdown" : "Download .md"}
                </button>
              </div>
            </div>

            {/* Text result */}
            <div className="relative rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">
                {result.isPaid ? result.full_text : result.preview}
              </pre>

              {/* Paywall overlay */}
              {!result.isPaid && result.total_chars > 500 && (
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center rounded-b-xl bg-gradient-to-t from-white via-white/95 to-transparent pb-8 pt-32">
                  <p className="mb-4 text-center text-lg font-semibold text-slate-800">
                    {lang === "ch"
                      ? `完整内容共 ${result.total_chars} 字，解锁查看全部`
                      : `Full content: ${result.total_chars} chars. Unlock to see all.`}
                  </p>
                  <button
                    onClick={handleUnlock}
                    className="rounded-xl bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-lg transition-all hover:bg-indigo-700 hover:shadow-xl"
                  >
                    {!session?.user
                      ? lang === "ch"
                        ? "登录后解锁 - $0.99"
                        : "Sign in to Unlock - $0.99"
                      : lang === "ch"
                        ? "解锁完整结果 - $0.99"
                        : "Unlock Full Result - $0.99"}
                  </button>
                  <p className="mt-2 text-xs text-slate-400">
                    {lang === "ch"
                      ? "单次购买 | 安全支付"
                      : "One-time purchase | Secure payment"}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Features */}
        <section className="mb-16 grid gap-8 sm:grid-cols-3">
          {[
            {
              icon: "📏",
              title: lang === "ch" ? "长图专家" : "Long Image Expert",
              desc:
                lang === "ch"
                  ? "智能切分超长截图，逐段识别后无缝合并，告别文字丢失"
                  : "Smart splitting of ultra-long screenshots with seamless merging",
            },
            {
              icon: "💬",
              title: lang === "ch" ? "场景优化" : "Scene Optimized",
              desc:
                lang === "ch"
                  ? "聊天记录、会议转写、文章长文，针对不同场景优化识别和排版"
                  : "Chat, meeting, article modes with tailored recognition & formatting",
            },
            {
              icon: "📝",
              title: lang === "ch" ? "Markdown 输出" : "Markdown Output",
              desc:
                lang === "ch"
                  ? "输出结构化 Markdown，保留格式、标题、列表、对话结构"
                  : "Structured Markdown output preserving headings, lists, and layout",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm"
            >
              <div className="mb-3 text-3xl">{f.icon}</div>
              <h3 className="mb-2 font-semibold text-slate-900">{f.title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* Pricing */}
        <section id="pricing" className="mb-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">
            {lang === "ch" ? "简单定价" : "Simple Pricing"}
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                name: lang === "ch" ? "免费" : "Free",
                price: "$0",
                features:
                  lang === "ch"
                    ? ["每天 3 次免费转换", "短图完整结果", "长图预览前20%"]
                    : [
                        "3 free conversions/day",
                        "Full result for short images",
                        "Preview first 20% for long images",
                      ],
              },
              {
                name: "Pro",
                price: "$4.99/mo",
                features:
                  lang === "ch"
                    ? [
                        "无限转换次数",
                        "完整结果 + 下载",
                        "所有场景模式",
                        "优先处理速度",
                      ]
                    : [
                        "Unlimited conversions",
                        "Full results + download",
                        "All scene modes",
                        "Priority processing",
                      ],
                highlight: true,
              },
              {
                name: lang === "ch" ? "单次购买" : "Pay-per-use",
                price: "$0.99",
                features:
                  lang === "ch"
                    ? ["单张图片完整结果", "无需订阅", "即买即用"]
                    : [
                        "Full result for one image",
                        "No subscription needed",
                        "Instant access",
                      ],
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-6 ${
                  plan.highlight
                    ? "border-indigo-200 bg-indigo-50 shadow-md"
                    : "border-slate-100 bg-white"
                }`}
              >
                <h3 className="mb-1 text-lg font-semibold text-slate-900">
                  {plan.name}
                </h3>
                <p className="mb-4 text-2xl font-bold text-indigo-600">
                  {plan.price}
                </p>
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm text-slate-600"
                    >
                      <span className="text-green-500">&#10003;</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* SEO Content */}
        <section className="mb-16 rounded-xl bg-slate-50 p-8">
          <h2 className="mb-4 text-xl font-bold text-slate-900">
            {lang === "ch"
              ? "为什么选择 Long2Text？"
              : "Why Long2Text?"}
          </h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            {lang === "ch" ? (
              <>
                <p>
                  普通的OCR工具在处理超长截图时会出现文字丢失、乱码、格式混乱等问题。Long2Text
                  专门针对长截图场景进行了优化——通过智能切分和重叠识别技术，确保每一个字都不会遗漏。
                </p>
                <p>
                  无论是微信聊天记录截图、飞书妙记会议截图、小红书长图文章，还是任何超长的屏幕截图，Long2Text
                  都能准确识别并输出格式化的 Markdown 文本，保留原始的对话结构和排版。
                </p>
              </>
            ) : (
              <>
                <p>
                  Regular OCR tools struggle with ultra-long screenshots —
                  missing text, garbled output, broken formatting. Long2Text is
                  purpose-built for long screenshots using smart splitting and
                  overlap technology to ensure every character is captured.
                </p>
                <p>
                  Whether it&apos;s chat history screenshots, meeting transcript
                  captures, or long article screenshots, Long2Text accurately
                  recognizes and outputs formatted Markdown while preserving the
                  original structure.
                </p>
              </>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white py-8">
        <div className="mx-auto max-w-5xl px-6 text-center text-sm text-slate-400">
          <p>&copy; 2026 Long2Text. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
