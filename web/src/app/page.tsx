"use client";

import { useState, useCallback, useRef } from "react";

const API_URL = "";

type Scene = "general" | "chat" | "meeting" | "article";
type Lang = "ch" | "en";
type Status = "idle" | "uploading" | "processing" | "done" | "error";

interface OCRResult {
  preview: string;
  full_text: string;
  total_chars: number;
  total_lines: number;
  segments_processed: number;
}

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [scene, setScene] = useState<Scene>("general");
  const [lang, setLang] = useState<Lang>("ch");
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file (PNG, JPG, WEBP)");
        return;
      }

      // Show preview
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setStatus("uploading");
      setError("");
      setResult(null);
      setIsPaid(false);

      try {
        setStatus("processing");

        const formData = new FormData();
        formData.append("file", file);
        formData.append("lang", lang);
        formData.append("scene", scene);

        const res = await fetch(`${API_URL}/api/ocr`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`Server error: ${res.status}`);
        }

        const data = await res.json();
        if (data.success) {
          setResult(data.result);
          setStatus("done");
        } else {
          throw new Error(data.detail || "Processing failed");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      }
    },
    [lang, scene],
  );

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
          <nav className="flex items-center gap-6 text-sm text-slate-600">
            <button
              onClick={() => setLang(lang === "ch" ? "en" : "ch")}
              className="rounded-md px-3 py-1 hover:bg-slate-100"
            >
              {lang === "ch" ? "EN" : "中文"}
            </button>
            <a
              href="#pricing"
              className="hover:text-slate-900"
            >
              {lang === "ch" ? "价格" : "Pricing"}
            </a>
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
          } ${status === "idle" || status === "error" ? "cursor-pointer" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() =>
            (status === "idle" || status === "error") &&
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
          ) : status === "processing" || status === "uploading" ? (
            <div className="flex flex-col items-center">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
              <p className="text-lg font-medium text-slate-700">
                {lang === "ch"
                  ? "正在识别中，请稍候..."
                  : "Processing your image..."}
              </p>
              <p className="text-sm text-slate-400">
                {lang === "ch"
                  ? "长图会被智能切分，逐段识别后合并"
                  : "Splitting, recognizing each segment, then merging"}
              </p>
            </div>
          ) : null}
        </section>

        {/* Image Preview */}
        {previewUrl && status !== "idle" && (
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

        {/* Results */}
        {status === "done" && result && (
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
                    if (isPaid && result.full_text) {
                      copyToClipboard(result.full_text);
                    } else {
                      copyToClipboard(result.preview);
                    }
                  }}
                  className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
                >
                  {lang === "ch" ? "复制文字" : "Copy Text"}
                </button>
                <button
                  onClick={() => {
                    const text = isPaid ? result.full_text : result.preview;
                    const blob = new Blob([text], { type: "text/markdown" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "long2text-result.md";
                    a.click();
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
                {isPaid ? result.full_text : result.preview}
              </pre>

              {/* Paywall overlay */}
              {!isPaid && result.total_chars > 500 && (
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center rounded-b-xl bg-gradient-to-t from-white via-white/95 to-transparent pb-8 pt-32">
                  <p className="mb-4 text-center text-lg font-semibold text-slate-800">
                    {lang === "ch"
                      ? `完整内容共 ${result.total_chars} 字，解锁查看全部`
                      : `Full content: ${result.total_chars} chars. Unlock to see all.`}
                  </p>
                  <button
                    onClick={() => setIsPaid(true)}
                    className="rounded-xl bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-lg transition-all hover:bg-indigo-700 hover:shadow-xl"
                  >
                    {lang === "ch"
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

            {/* Try another */}
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setStatus("idle");
                  setResult(null);
                  setPreviewUrl(null);
                  setIsPaid(false);
                }}
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                {lang === "ch" ? "转换另一张图片" : "Convert another image"}
              </button>
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
