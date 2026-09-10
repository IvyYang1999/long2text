"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MarkdownView from "@/components/MarkdownView";

interface HistoryItem {
  id: string;
  preview: string;
  fullText: string | null;
  totalChars: number;
  segmentsProcessed: number;
  createdAt: string;
  isPaid: boolean;
}

const FREE_CHARS = 500;

export default function HistoryPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [zh, setZh] = useState(true);

  useEffect(() => {
    // Browser language is only known on the client; one-time sync after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (typeof navigator !== "undefined" && !/^zh/i.test(navigator.language)) setZh(false);
  }, []);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/");
      return;
    }
    if (authStatus === "authenticated") {
      fetch("/api/ocr-results")
        .then((r) => r.json())
        .then((data) => {
          setItems(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [authStatus, router]);

  const handleUnlock = async (resultId: string) => {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ocrResultId: resultId }),
    });
    const data = await res.json();
    if (data.url) window.location.assign(data.url);
  };

  const copy = async (item: HistoryItem) => {
    await navigator.clipboard.writeText(item.fullText || item.preview);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (authStatus === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">L2T</div>
            <span className="text-lg font-semibold text-slate-900">Long2Text</span>
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={() => setZh(!zh)} className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100">
              {zh ? "EN" : "中文"}
            </button>
            {session?.user?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.user.image} alt="" className="h-7 w-7 rounded-full" />
            )}
            <span className="hidden text-sm text-slate-600 sm:inline">{session?.user?.name}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">{zh ? "历史记录" : "History"}</h1>
          <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-700">
            {zh ? "＋ 转换新图片" : "＋ Convert another"}
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <p className="text-slate-500">{zh ? "还没有识别记录" : "No results yet"}</p>
            <Link href="/" className="mt-4 inline-block text-sm text-indigo-600 hover:text-indigo-700">
              {zh ? "去转换图片" : "Convert an image"}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const unlocked = item.isPaid || item.totalChars <= FREE_CHARS;
              const open = expandedId === item.id;
              return (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span>
                        {item.totalChars} {zh ? "字" : "chars"}
                      </span>
                      <span>
                        {item.segmentsProcessed} {zh ? "段" : "segments"}
                      </span>
                      <span>
                        {new Date(item.createdAt).toLocaleString(zh ? "zh-CN" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {unlocked && item.totalChars > FREE_CHARS && <span className="text-green-600">{zh ? "已解锁" : "Unlocked"}</span>}
                    </div>
                    <div className="flex gap-2">
                      {unlocked ? (
                        <>
                          <button onClick={() => setExpandedId(open ? null : item.id)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200">
                            {open ? (zh ? "收起" : "Collapse") : zh ? "展开全文" : "Expand"}
                          </button>
                          <button onClick={() => copy(item)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700">
                            {copiedId === item.id ? (zh ? "已复制" : "Copied") : zh ? "复制 Markdown" : "Copy Markdown"}
                          </button>
                        </>
                      ) : (
                        <button onClick={() => handleUnlock(item.id)} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                          {zh ? "解锁全文 · $0.99" : "Unlock · $0.99"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={open ? "" : "max-h-40 overflow-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent)]"}>
                    <MarkdownView markdown={open && item.fullText ? item.fullText : item.preview} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
