import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { guideSample, guideSampleIds } from "@/lib/guide-samples";
import { makeZip } from "@/lib/export";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return guideSampleIds.flatMap(id => [{ file: `${id}.md` }, { file: `${id}.zip` }]);
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const match = /^(en-chat|en-article)\.(md|zip)$/.exec(file);
  const sample = match && guideSample(match[1]);
  if (!sample || !match) return new Response("Not found", { status: 404 });
  const headers = { "Content-Disposition": `attachment; filename="${file}"`, "X-Content-Type-Options": "nosniff" };
  if (match[2] === "md") return new Response(sample.textMarkdown, { headers: { ...headers, "Content-Type": "text/markdown; charset=utf-8" } });
  const encode = (text: string) => new TextEncoder().encode(text);
  const files = [{ name: `${sample.id}.md`, data: encode(sample.portableMarkdown) }];
  for (const figure of sample.figures) {
    files.push({ name: `images/${figure.id}.jpg`, data: await readFile(join(process.cwd(), "public", "samples", "figs", `${sample.id}-${figure.id}.jpg`)) });
  }
  files.push({ name: "README.txt", data: encode("Long2Text public demo — complete recorded OCR output.\nNo manual proofreading. Names, headings and line breaks may contain recognition errors.\nKeep the Markdown and images directory together. The images are public demo assets, not customer uploads.\nRecorded OCR timing excludes exports and AI proofreading and is not a current performance guarantee.\nSource: https://long2text.com/" + (sample.id === "en-chat" ? "chat-screenshot-to-text" : "screenshot-to-markdown") + "\n") });
  return new Response(makeZip(files), { headers: { ...headers, "Content-Type": "application/zip" } });
}
