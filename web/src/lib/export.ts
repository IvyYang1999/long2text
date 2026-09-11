/**
 * Turning a result into things people take away: Markdown with image files,
 * rich HTML for pasting into docs, text-only for storage.
 * Figure references inside Markdown look like ![alt](fig:<id>).
 */
const FIG = /!\[([^\]]*)\]\(fig:([^)]+)\)/g;

export type OutputMode = "text" | "rich" | "both";

export interface FigInfo {
  id: string;
  ocrText: string;
  desc?: string;
}

/**
 * Re-write picture references for an output mode:
 *  text — no pictures; each becomes a bracketed description a reader (or a
 *         screen reader, or an AI) can follow: [Sticker: a smiling face, “Got it!”]
 *  rich — pictures kept; caption = the text found inside the picture, if any
 *  both — pictures kept, captioned with the AI description
 */
export function applyMode(md: string, figs: FigInfo[], mode: OutputMode, label: string): string {
  const byId = new Map(figs.map((f) => [f.id, f]));
  return md.replace(FIG, (_, _alt: string, id: string) => {
    const f = byId.get(id);
    const ocr = (f?.ocrText || "").replace(/[\[\]()]/g, " ").trim();
    const desc = (f?.desc || "").replace(/[\[\]()]/g, " ").trim();
    if (mode === "text") return `[${desc || (ocr ? `${label}：${ocr}` : label)}]`;
    if (mode === "both") return `![${desc || ocr || label}](fig:${id})`;
    return `![${ocr}](fig:${id})`;
  });
}

/** For the database: pictures are never stored, only their captions. */
export function forStorage(md: string, label: string): string {
  return md.replace(FIG, (_, alt: string) => `[${label}${alt && alt !== label ? `：${alt}` : ""}]`);
}

/** For a downloaded .md next to an images/ folder. */
export function withImageFiles(md: string): string {
  return md.replace(FIG, (_, alt: string, id: string) => `![${alt}](images/${id}.jpg)`);
}

export function figureIds(md: string): string[] {
  return [...md.matchAll(FIG)].map((m) => m[2]);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string, src: (id: string) => string | undefined): string {
  let out = "";
  let last = 0;
  for (const m of s.matchAll(FIG)) {
    out += fmt(s.slice(last, m.index));
    const url = src(m[2]);
    out += url ? `<img src="${url}" alt="${esc(m[1])}" style="max-width:320px;border-radius:8px">` : `[${esc(m[1])}]`;
    last = (m.index || 0) + m[0].length;
  }
  return out + fmt(s.slice(last));
}

function fmt(s: string): string {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$)/g, '$1<span style="color:#8b93a5">$2</span>');
}

/** Minimal Markdown → HTML for the subset produced by lib/structure.ts. */
export function toHtml(md: string, src: (id: string) => string | undefined): string {
  return md
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      if (b.startsWith("# ")) return `<h1>${inline(b.slice(2), src)}</h1>`;
      if (b.startsWith("## ")) return `<h2>${inline(b.slice(3), src)}</h2>`;
      if (b.startsWith("- ")) return `<ul>${b.split("\n").map((l) => `<li>${inline(l.replace(/^- /, ""), src)}</li>`).join("")}</ul>`;
      return `<p>${b.split("\n").map((l) => inline(l, src)).join("<br>")}</p>`;
    })
    .join("\n");
}

// ── tiny zip writer (stored, no compression — images are already compressed) ──
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(d: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = CRC_TABLE[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function makeZip(files: { name: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true);
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, f.data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true);
    cen.setUint16(12, dosTime, true);
    cen.setUint16(14, dosDate, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, f.data.length, true);
    cen.setUint32(24, f.data.length, true);
    cen.setUint16(28, name.length, true);
    cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const size = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[], { type: "application/zip" });
}

/**
 * A self-contained, nicely typeset HTML page (pictures embedded as data URLs).
 * Chats become left/right bubbles; everything else reads like an article.
 */
export function toStyledHtml(o: { title: string; md: string; chat: boolean; me: string; src: (id: string) => string | undefined; lang: string }): string {
  const blocks = o.md.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const body = blocks
    .map((b) => {
      if (o.chat) {
        const ts = b.match(/^\*([^*]+)\*$/);
        if (ts) return `<div class="ts">${esc(ts[1])}</div>`;
        const m = b.match(/^\*\*([^*]+)\*\*[：:]\s*([\s\S]*)$/);
        if (m) {
          const mine = m[1] === o.me;
          const content = inline(m[2], o.src);
          const pic = /^<img /.test(content) && !content.replace(/<img [^>]+>/, "").trim();
          return `<div class="msg ${mine ? "me" : ""}">${mine ? "" : `<div class="who">${esc(m[1])}</div>`}<div class="bubble${pic ? " pic" : ""}">${content}</div></div>`;
        }
        const name = b.match(/^\*\*([^*]+)\*\*(.*)$/);
        if (name) return `<div class="who solo">${inline(b, o.src)}</div>`;
        return `<div class="sys">${inline(b, o.src)}</div>`;
      }
      if (b.startsWith("# ")) return `<h1>${inline(b.slice(2), o.src)}</h1>`;
      if (b.startsWith("## ")) return `<h2>${inline(b.slice(3), o.src)}</h2>`;
      if (b.startsWith("- ")) return `<ul>${b.split("\n").map((l) => `<li>${inline(l.replace(/^- /, ""), o.src)}</li>`).join("")}</ul>`;
      return `<p>${b.split("\n").map((l) => inline(l, o.src)).join("<br>")}</p>`;
    })
    .join("\n");
  return `<!doctype html><html lang="${o.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.title)}</title><style>
:root{color-scheme:light}body{margin:0;background:${o.chat ? "#ededed" : "#fff"};font:16px/1.7 -apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif;color:#1b1f27}
main{max-width:${o.chat ? 620 : 700}px;margin:0 auto;padding:32px 20px 64px}h1{font-size:28px;line-height:1.3;margin:8px 0 20px}h2{font-size:21px;margin:32px 0 8px}p{margin:0 0 16px}ul{padding-left:22px}
img{max-width:100%;border-radius:10px;display:block;margin:4px 0}.ts{text-align:center;color:#999;font-size:13px;margin:18px 0 10px}.sys{text-align:center;color:#8a8a8a;font-size:13px;margin:10px 0}
.msg{display:flex;flex-direction:column;align-items:flex-start;margin:10px 0}.msg.me{align-items:flex-end}.who{font-size:12px;color:#8a8a8a;margin:0 4px 3px}.who.solo{margin:14px 0 2px}
.bubble{max-width:78%;background:#fff;border-radius:10px;padding:9px 13px;word-break:break-word}.me .bubble{background:#95ec69}.bubble.pic{background:none;padding:0}.bubble.pic img{max-width:240px}
footer{margin-top:40px;text-align:center;color:#aaa;font-size:12px}</style></head><body><main>${body}<footer>Long2Text</footer></main></body></html>`;
}
