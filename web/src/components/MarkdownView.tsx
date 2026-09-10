"use client";

import { Fragment } from "react";

/**
 * Minimal renderer for the Markdown subset produced by lib/structure.ts:
 *   # / ## headings, **bold** (speaker names), *italic* (timestamps),
 *   "- " bullets, "1. " numbered items, paragraphs separated by blank lines.
 * No external dependency, no raw HTML.
 */
function renderInline(text: string, key: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={`${key}-${i}`} className="font-semibold text-slate-900">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (p.startsWith("*") && p.endsWith("*")) {
      return (
        <span key={`${key}-${i}`} className="text-xs text-slate-400">
          {p.slice(1, -1)}
        </span>
      );
    }
    return <Fragment key={`${key}-${i}`}>{p}</Fragment>;
  });
}

export default function MarkdownView({ markdown, className = "" }: { markdown: string; className?: string }) {
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
              {renderInline(t.slice(2), key)}
            </h2>
          );
        }
        if (t.startsWith("## ")) {
          return (
            <h3 key={key} className="pt-1 text-base font-semibold text-slate-900">
              {renderInline(t.slice(3), key)}
            </h3>
          );
        }
        if (/^\*[^*\n]+\*$/.test(t)) {
          return (
            <p key={key} className="text-center text-xs text-slate-400">
              {t.slice(1, -1)}
            </p>
          );
        }
        if (t.startsWith("- ")) {
          return (
            <ul key={key} className="list-disc pl-5">
              {t.split("\n").map((l, j) => (
                <li key={`${key}-${j}`}>{renderInline(l.replace(/^- /, ""), `${key}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={key} className="whitespace-pre-wrap">
            {t.split("\n").map((l, j) => (
              <Fragment key={`${key}-${j}`}>
                {j > 0 && <br />}
                {renderInline(l, `${key}-${j}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
