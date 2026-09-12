import Image from "next/image";
import MarkdownView from "@/components/MarkdownView";
import { guideSample, type GuideSampleId } from "@/lib/guide-samples";

export default function GuideExample({ id }: { id: GuideSampleId }) {
  const sample = guideSample(id)!;
  return (
    <section id="example" className="mt-14 scroll-mt-24">
      <h2 className="text-2xl font-semibold tracking-tight text-ink">One long screenshot. The complete result.</h2>
      <p className="mt-3 max-w-3xl leading-relaxed text-muted">Explore the full recorded output, including its imperfections. These are our public demo images, not customer uploads. No manual proofreading has been applied to the transcript.</p>
      <p className="mt-3 text-sm leading-relaxed text-muted">{sample.width} × {sample.height.toLocaleString("en-US")} pixels · {sample.slices} slices · Recorded OCR-only time: {sample.secs}s. This cached baseline excludes image export and AI proofreading; it is not a fresh speed test or a guarantee.</p>
      <div className="mt-6 grid min-w-0 gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <figure className="min-w-0">
          <figcaption className="mb-3 text-sm font-medium text-ink">Original screenshot</figcaption>
          <div role="region" aria-label="Scrollable source screenshot" tabIndex={0} className="h-96 overflow-auto overscroll-contain rounded-xl border border-line focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            <Image src={`/samples/${id}.jpg`} alt={`${id === "en-chat" ? "Chat conversation" : "Article"} public demo screenshot`} width={sample.width} height={sample.height} sizes="(max-width: 640px) 100vw, 360px" className="h-auto w-full" />
          </div>
          <a href={`/samples/${id}.jpg`} className="mt-3 inline-block py-2 text-sm text-accent underline underline-offset-4">Open full source image</a>
        </figure>
        <div className="min-w-0">
          <h3 className="mb-3 text-sm font-medium text-ink">Rendered Markdown · full output</h3>
          <div role="region" aria-label="Scrollable complete output" tabIndex={0} className="h-96 overflow-auto overscroll-contain break-words rounded-xl border border-line bg-wash p-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            <MarkdownView markdown={sample.markdown} figures={sample.figureUrls} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-accent">
            <a href={`/samples/${id}.zip`} download className="py-2 underline underline-offset-4">Download Markdown + images</a>
            <a href={`/samples/${id}.md`} download className="py-2 underline underline-offset-4">Download text-only Markdown</a>
          </div>
        </div>
      </div>
      <details className="mt-5 rounded-xl border border-line p-5">
        <summary className="cursor-pointer font-medium text-ink">View complete Markdown source</summary>
        <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-ink"><code>{sample.portableMarkdown}</code></pre>
      </details>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">For Obsidian: unzip the download, then move the Markdown file and its images folder together into a note folder. The transcript and image links are unchanged apart from making the file paths portable. For a text-only workflow, use the .md download; picture descriptions come from the recorded demo.</p>
    </section>
  );
}
