"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface HistoryItem {
  id: string;
  preview: string;
  fullText: string | null;
  totalChars: number;
  segmentsProcessed: number;
  createdAt: string;
  isPaid: boolean;
}

export default function HistoryPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/");
      return;
    }
    if (authStatus === "authenticated") {
      fetch("/api/ocr-results")
        .then((r) => r.json())
        .then((data) => {
          setItems(data);
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
    if (data.url) {
      window.location.href = data.url;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              L2T
            </div>
            <span className="text-lg font-semibold text-slate-900">
              Long2Text
            </span>
          </a>
          <div className="flex items-center gap-3">
            {session?.user?.image && (
              <img
                src={session.user.image}
                alt=""
                className="h-7 w-7 rounded-full"
              />
            )}
            <span className="text-sm text-slate-600">
              {session?.user?.name}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="mb-8 text-2xl font-bold text-slate-900">历史记录</h1>

        {items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <p className="text-slate-500">暂无 OCR 记录</p>
            <a
              href="/"
              className="mt-4 inline-block text-sm text-indigo-600 hover:text-indigo-700"
            >
              去转换图片
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex gap-4 text-sm text-slate-500">
                    <span>{item.totalChars} 字</span>
                    <span>{item.segmentsProcessed} 段</span>
                    <span>
                      {new Date(item.createdAt).toLocaleDateString("zh-CN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {item.isPaid || item.totalChars <= 500 ? (
                      <>
                        <button
                          onClick={() =>
                            setExpandedId(
                              expandedId === item.id ? null : item.id,
                            )
                          }
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200"
                        >
                          {expandedId === item.id ? "收起" : "展开全文"}
                        </button>
                        <button
                          onClick={() =>
                            copyToClipboard(item.fullText || item.preview)
                          }
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
                        >
                          复制
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleUnlock(item.id)}
                        className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                      >
                        解锁 $0.99
                      </button>
                    )}
                  </div>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
                  {expandedId === item.id && item.fullText
                    ? item.fullText
                    : item.preview.slice(0, 200) +
                      (item.preview.length > 200 ? "..." : "")}
                </pre>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
