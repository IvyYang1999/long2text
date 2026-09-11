import type { Dict } from "@/lib/i18n";

/**
 * Illustration of what the product does: a long chat screenshot being read,
 * and the Markdown it turns into. Pure markup, no images, decorative only.
 */
export default function HeroDemo({ d }: { d: Dict }) {
  const msgs = d.demo.msgs;
  return (
    <div className="relative mx-auto h-[440px] w-full max-w-[460px] select-none" aria-hidden="true">
      {/* the screenshot */}
      <div className="absolute left-0 top-0 h-[420px] w-[230px] overflow-hidden rounded-[28px] border border-line bg-[#ededed] shadow-[0_1px_2px_rgba(13,19,33,.06),0_24px_48px_-12px_rgba(13,19,33,.18)]">
        <div className="flex h-11 items-center justify-center border-b border-black/5 bg-[#f7f7f7] text-[12px] font-medium text-ink">
          {d.demo.appName}
        </div>
        <div className="space-y-3 px-3 pt-3">
          {[...msgs, ...d.demo.more].map((m, i) => {
            const mine = m.who === d.work.me;
            return (
              <div key={i} className={`flex items-start gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
                <div className={`mt-0.5 h-6 w-6 shrink-0 rounded-md ${mine ? "bg-[#7aa7ff]" : "bg-[#f3b45b]"}`} />
                <div className={`max-w-[150px] rounded-md px-2 py-1.5 text-[10.5px] leading-snug text-ink ${mine ? "bg-[#95ec69]" : "bg-white"}`}>
                  {m.text}
                </div>
              </div>
            );
          })}
        </div>
        <div className="l2t-scan pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-[rgba(51,85,255,.18)] to-transparent">
          <div className="absolute inset-x-0 top-1/2 h-px bg-accent/70" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#ededed] to-transparent" />
      </div>

      {/* the output */}
      <div className="absolute bottom-0 right-0 w-[290px] rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(13,19,33,.06),0_28px_56px_-16px_rgba(13,19,33,.22)]">
        <div className="mb-3 flex items-center justify-between">
          <span className="rounded-md bg-wash px-1.5 py-0.5 font-mono text-[10.5px] text-muted">{d.demo.output}</span>
          <span className="flex gap-1">
            <span className="h-2 w-2 rounded-full bg-line" />
            <span className="h-2 w-2 rounded-full bg-line" />
          </span>
        </div>
        <div className="space-y-2.5 text-[12.5px] leading-relaxed">
          {msgs.map((m, i) => (
            <p key={i} className="l2t-rise" style={{ animationDelay: `${0.6 + i * 0.9}s` }}>
              <span className="font-semibold text-ink">{m.who}</span>
              <span className="ml-1.5 text-[11px] text-faint">{m.time}</span>
              <br />
              <span className="text-[#2b3242]">{m.text}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
