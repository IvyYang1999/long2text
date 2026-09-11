"use client";

import { useEffect, useRef, useState } from "react";
import cases from "@/lib/cases.json";
import { applyMode, type OutputMode } from "@/lib/export";
import type { Dict } from "@/lib/i18n";
import MarkdownView from "@/components/MarkdownView";

type Kind = "chat" | "meeting" | "article";
type Case = { width: number; height: number; slices: number; secs: number; markdown: string; figures: { id: string; ocrText: string; desc: string }[] };
const KINDS: Kind[] = ["chat", "meeting", "article"];

/**
 * A real example: the whole long screenshot pans slowly on the left while the
 * text it became pans on the right. Outputs are precomputed by running the
 * sample images through the production pipeline (see vault 测试脚本/gen-cases).
 */
export default function CaseShowcase({ d, onTry }: { d: Dict; onTry: (kind: Kind) => void }) {
  const [kind, setKind] = useState<Kind>("chat");
  const [view, setView] = useState<Extract<OutputMode, "rich" | "text">>("rich");
  const c = (cases as Record<string, Case>)[`${d.locale}-${kind}`];
  const src = `/samples/${d.locale}-${kind}.jpg`;
  const figures = Object.fromEntries(c.figures.map((f) => [f.id, `/samples/figs/${d.locale}-${kind}-${f.id}.jpg`]));
  const md = applyMode(c.markdown, c.figures, view === "text" ? "text" : "rich", d.work.image);

  const shotBox = useRef<HTMLDivElement>(null);
  const shot = useRef<HTMLImageElement>(null);
  const textBox = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ shot: 0, text: 0 });

  useEffect(() => {
    const measure = () => {
      const s = Math.max(0, (shot.current?.clientHeight || 0) - (shotBox.current?.clientHeight || 0));
      const t = Math.max(0, (text.current?.scrollHeight || 0) - (textBox.current?.clientHeight || 0));
      setPan({ shot: s, text: t });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (shot.current) ro.observe(shot.current);
    if (text.current) ro.observe(text.current);
    return () => ro.disconnect();
  }, [kind, view]);

  const dur = `${Math.max(14, Math.round(pan.shot / 45))}s`;

  return (
    <div className="rounded-3xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(13,19,33,.05),0_24px_48px_-20px_rgba(13,19,33,.18)] sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-muted">{d.cases.title}</p>
        <div className="flex rounded-full bg-wash p-0.5">
          {KINDS.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-full px-2.5 py-1 text-[12.5px] transition ${kind === k ? "bg-white font-medium text-ink shadow-sm" : "text-muted hover:text-ink"}`}
            >
              {d.cases.kinds[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid h-[360px] grid-cols-[104px_minmax(0,1fr)] gap-4 sm:h-[420px] sm:grid-cols-[132px_minmax(0,1fr)]">
        <div ref={shotBox} className="relative overflow-hidden rounded-xl border border-line bg-wash">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={src}
            ref={shot}
            src={src}
            alt={d.cases.tall(c.height)}
            onLoad={() => setPan((p) => ({ ...p, shot: Math.max(0, (shot.current?.clientHeight || 0) - (shotBox.current?.clientHeight || 0)) }))}
            className="l2t-pan block w-full"
            style={{ ["--pan" as string]: `-${pan.shot}px`, ["--dur" as string]: dur }}
          />
          <span className="absolute bottom-2 left-2 rounded-md bg-ink/75 px-1.5 py-0.5 font-mono text-[10.5px] text-white backdrop-blur">{d.cases.tall(c.height)}</span>
        </div>
        <div ref={textBox} className="relative overflow-hidden">
          <div key={`${kind}-${view}`} ref={text} className="l2t-pan" style={{ ["--pan" as string]: `-${pan.text}px`, ["--dur" as string]: dur }}>
            <MarkdownView markdown={md} figures={figures} captions={false} className="text-[13px]" />
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-white to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-faint">
        <span className="tabular-nums">{d.cases.meta(c.width, c.height, c.slices, c.secs)}</span>
        <div className="flex items-center gap-3">
          {c.figures.length > 0 && (
            <div className="flex rounded-full bg-wash p-0.5">
              {(["rich", "text"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`rounded-full px-2 py-0.5 text-[11.5px] ${view === v ? "bg-white text-ink shadow-sm" : "text-muted"}`}>
                  {d.cases.views[v]}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => onTry(kind)} className="font-medium text-accent hover:text-accent-hover">
            {d.cases.try}
          </button>
        </div>
      </div>
    </div>
  );
}
