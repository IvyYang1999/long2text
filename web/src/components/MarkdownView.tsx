"use client";

import { Fragment } from "react";

/**
 * Minimal renderer for the Markdown subset produced by lib/structure.ts:
 *   # / ## headings, **bold** (speaker names), *italic* (timestamps),
 *   "- " bullets, "1. " numbered items, paragraphs separated by blank lines.
 * No external dependency, no raw HTML.
 */
type MarkHandler = { onMark?: (index: number) => void; markTitle?: (original: string) => string };

// Display-only AI-correction markers inserted by lib/ai-correct.ts markCorrections():
//   U+E000 <index> U+E003 <new span> U+E001 <old span> U+E002
const MARK_SPLIT = /(\uE000\d+\uE003[^\uE001]*\uE001[^\uE002]*\uE002)/g;
const MARK_PARSE = /^\uE000(\d+)\uE003([^\uE001]*)\uE001([^\uE002]*)\uE002$/;

function renderMarks(text: string, key: string, h: MarkHandler) {
  if (!text.includes("\uE000")) return text;
  return text.split(MARK_SPLIT).filter(Boolean).map((part, i) => {
    const m = part.match(MARK_PARSE);
    if (!m) return <Fragment key={`${key}-m${i}`}>{part}</Fragment>;
    const [, idx, now, was] = m;
    return (
      <mark
        key={`${key}-m${i}`}
        role="button"
        tabIndex={0}
        title={h.markTitle ? h.markTitle(was) : was}
        onClick={() => h.onMark?.(Number(idx))}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") h.onMark?.(Number(idx));
        }}
        className="cursor-pointer rounded bg-amber-100 px-0.5 text-slate-900 underline decoration-amber-400 decoration-dotted underline-offset-4 hover:bg-amber-200"
      >
        {now || "∅"}
      </mark>
    );
  });
}

/** Minimal inline renderer: **bold** (speaker names), *italic* (timestamps), AI-correction marks. */
function renderInline(text: string, key: string, h: MarkHandler) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
      return (
        <strong key={`${key}-${i}`} className="font-semibold text-slate-900">
          {renderMarks(p.slice(2, -2), `${key}-${i}`, h)}
        </strong>
      );
    }
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) {
      return (
        <span key={`${key}-${i}`} className="text-xs text-slate-400">
          {renderMarks(p.slice(1, -1), `${key}-${i}`, h)}
        </span>
      );
    }
    return <Fragment key={`${key}-${i}`}>{renderMarks(p, `${key}-${i}`, h)}</Fragment>;
  });
}

export default function MarkdownView({
  markdown,
  className = "",
  onMark,
  markTitle,
}: {
  markdown: string;
  className?: string;
  onMark?: (index: number) => void;
  markTitle?: (original: string) => string;
}) {
  const h: MarkHandler = { onMark, markTitle };
  const blocks = markdown.split(/\n{2,}/);
  return (
    <div className={`space-y-3 text-sm leading-relaxed text-slate-800 ${className}`}>
      {blocks.map((b, i) => {
        const t = b.trim();
        if (!t) return null;
        const key = `b${i}`;
        if (t.startsWith("# ")) {
          return (
            <h2 key={key} className="pt-2 text-xl font-bold text-slate-900">
              {renderInline(t.slice(2), key, h)}
            </h2>
          );
        }
        if (t.startsWith("## ")) {
          return (
            <h3 key={key} className="pt-1 text-base font-semibold text-slate-900">
              {renderInline(t.slice(3), key, h)}
            </h3>
          );
        }
        if (/^\*[^*\n]+\*$/.test(t)) {
          return (
            <p key={key} className="text-center text-xs text-slate-400">
              {renderMarks(t.slice(1, -1), key, h)}
            </p>
          );
        }
        if (t.startsWith("- ")) {
          return (
            <ul key={key} className="list-disc pl-5">
              {t.split("\n").map((l, j) => (
                <li key={`${key}-${j}`}>{renderInline(l.replace(/^- /, ""), `${key}-${j}`, h)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={key} className="whitespace-pre-wrap">
            {t.split("\n").map((l, j) => (
              <Fragment key={`${key}-${j}`}>
                {j > 0 && <br />}
                {renderInline(l, `${key}-${j}`, h)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
