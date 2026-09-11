"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MarkdownView from "@/components/MarkdownView";
import SiteHeader from "@/components/SiteHeader";
import { dicts } from "@/lib/i18n";

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
  const { status: authStatus } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [zh, setZh] = useState(false);

  useEffect(() => {
    // Language is only known on the client (cookie, else browser); one-time sync after hydration.
    const cookie = document.cookie.match(/l2t-lang=(en|zh)/)?.[1];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZh(cookie ? cookie === "zh" : /^zh/i.test(navigator.language));
  }, []);
  const d = zh ? dicts.zh : dicts.en;

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
      body: JSON.stringify({ ocrResultId: resultId, returnPath: d.home }),
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
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-line border-t-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader locale={d.locale} />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-ink">{zh ? "历史记录" : "History"}</h1>
          <Link href="/" className="text-sm text-accent hover:text-accent-hover">
            {zh ? "＋ 转换新图片" : "＋ Convert another"}
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white p-12 text-center">
            <p className="text-muted">{zh ? "还没有识别记录" : "No results yet"}</p>
            <Link href="/" className="mt-4 inline-block text-sm text-accent hover:text-accent-hover">
              {zh ? "去转换图片" : "Convert an image"}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const unlocked = item.isPaid || item.totalChars <= FREE_CHARS;
              const open = expandedId === item.id;
              return (
                <div key={item.id} className="rounded-2xl border border-line bg-white p-5 sm:p-6">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
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
                          <button onClick={() => setExpandedId(open ? null : item.id)} className="rounded-full border border-line px-3.5 py-1.5 text-sm text-ink hover:border-faint">
                            {open ? (zh ? "收起" : "Collapse") : zh ? "展开全文" : "Expand"}
                          </button>
                          <button onClick={() => copy(item)} className="rounded-full bg-ink px-3.5 py-1.5 text-sm text-white hover:bg-[#1f2738]">
                            {copiedId === item.id ? (zh ? "已复制" : "Copied") : zh ? "复制 Markdown" : "Copy Markdown"}
                          </button>
                        </>
                      ) : (
                        <button onClick={() => handleUnlock(item.id)} className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover">
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
