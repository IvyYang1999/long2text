import Image from "next/image";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { SiteFooter } from "@/components/Landing";
import { dicts } from "@/lib/i18n";
import { SITE } from "@/lib/seo";
import { seoGuides } from "@/lib/seo-guides";
import cases from "@/lib/cases.json";

type GuideKind = "chat" | "markdown";
const content = {
  chat: {
    index: 0,
    heading: "Chat screenshot to text",
    intro: "A conversation is more than a block of words. Turn a long chat screenshot into a readable transcript, then check who said what before you reuse it.",
    sample: "en-chat" as const,
    purpose: "When the conversation only exists as an image",
    purposeText: "Use this for screenshots of WhatsApp, WeChat, Telegram or Slack conversations that you have permission to process. If you still have access to the original chat and can copy or export the text, start there: it avoids recognition errors. OCR is useful when someone shared a screenshot, or the text is otherwise unavailable.",
    steps: [
      ["Keep the original resolution", "Choose a PNG, JPG or WebP screenshot. Keep the messages, visible speaker names and timestamps. Crop unrelated notifications and redact private information before uploading."],
      ["Convert, then choose Chat layout", "Open the converter and upload your image. Long2Text splits tall images into overlapping slices. After recognition, choose Chat if automatic layout did not identify the conversation correctly."],
      ["Check the conversation, then export", "Compare names, dates and the order of messages against the image. Copy the Markdown or download the result. Use Text only if you do not need stickers and pictures."],
    ],
    reviewTitle: "Review these details before sharing",
    review: ["Speaker names can be misread, especially when the screenshot only shows an avatar or a cropped name.", "Timestamps must be visible in the image to be transcribed. OCR cannot recover hidden messages or missing dates.", "Quoted replies, narrow bubbles and screenshots inside screenshots can confuse reading order. Check these against the original."],
    faq: [
      ["Does this connect to my WhatsApp or other chat account?", "No. You upload an existing image; Long2Text does not connect to your chat accounts or retrieve conversations."],
      ["Can I search the conversation afterwards?", "Yes. Copy or save the extracted text, then search it in your text editor or notes app. Check important matches against the screenshot."],
      ["Can I use the transcript as an exact record?", "Keep the original image. Recognition and AI proofreading can make mistakes, so the extracted text is a working copy, not a guaranteed exact record."],
    ],
  },
  markdown: {
    index: 1,
    heading: "Screenshot to Markdown",
    intro: "Take the useful content out of a long screenshot. Recover editable paragraphs, headings and lists for your notes, with a source image you can check as you go.",
    sample: "en-article" as const,
    purpose: "From a saved image to a usable note",
    purposeText: "A screenshot preserves the appearance of an article, but its words are hard to edit or quote. Markdown turns the extracted content into portable text for Obsidian, documentation and other notes tools. Use the original text or a web clipper when that is available; use OCR when you only have the image.",
    steps: [
      ["Choose a clear screenshot", "Upload a PNG, JPG or WebP at its original resolution. Crop unrelated navigation and notifications. A readable source matters more than sharpening a tiny, compressed copy."],
      ["Review the document structure", "After conversion, choose Article layout for article-style content. Check heading levels, paragraph breaks and list items. Markdown preserves structure, not the original page's fonts or exact visual layout."],
      ["Copy the text or keep the pictures", "Use Copy Markdown for a text workflow. With pictures included, the download is a ZIP containing Markdown and an images folder. Keep those files together so relative image links continue to work."],
    ],
    reviewTitle: "What still needs a human check",
    review: ["A heading wrapped over two lines may become two headings. Merge it if the original image shows one title.", "Complex tables, code indentation, formulas and multi-column layouts may need manual reconstruction. Do not assume a visually correct preview means every value is right.", "A URL displayed only as a link label cannot be recovered from the image. Add the source URL yourself when you have it."],
    faq: [
      ["Is Markdown the same as a pixel-perfect copy?", "No. Markdown represents content structure such as headings, paragraphs and lists. It does not reproduce the source's exact typography, colors or page layout."],
      ["Can I use the result in Obsidian?", "Yes. Copy the Markdown into a note, or place the downloaded Markdown and its images folder together in your vault. Check the image paths if you move either afterwards."],
      ["Should I keep AI proofreading enabled?", "It is optional. It can help with uncertain OCR text, but changes still need review. Compare important wording and numbers with the screenshot before using the document."],
    ],
  },
};

export default function ConversionGuide({ kind }: { kind: GuideKind }) {
  const c = content[kind];
  const guide = seoGuides[c.index];
  const example = cases[c.sample];
  const excerpt = example.markdown.split("\n\n").slice(0, 5).join("\n\n");
  const breadcrumbs = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Long2Text", item: SITE },
      { "@type": "ListItem", position: 2, name: guide.label, item: `${SITE}/${guide.slug}` },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs).replace(/</g, "\\u003c") }} />
      <SiteHeader locale="en" />
      <main className="mx-auto max-w-5xl px-5 py-12 sm:py-20">
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link href="/" className="underline-offset-4 hover:underline">Long2Text</Link>
          <span aria-hidden="true" className="mx-2">/</span><span aria-current="page">{guide.label}</span>
        </nav>
        <h1 className="mt-7 max-w-3xl text-4xl font-bold tracking-tight text-ink sm:text-6xl">{c.heading}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{c.intro}</p>
        <div className="mt-7 flex flex-wrap items-center gap-5">
          <Link href="/" className="inline-flex rounded-full bg-accent px-6 py-3 font-medium text-white transition-colors hover:bg-accent-hover">Open the converter →</Link>
          <a href="#example" className="py-3 text-sm text-accent underline underline-offset-4">See a screenshot and its output</a>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">Free for images under 500 characters; longer results include a free 30% preview. <Link href="/#pricing" className="underline underline-offset-4">See current pricing</Link>.</p>

        <section className="mt-16 max-w-3xl border-t border-line pt-10">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">{c.purpose}</h2>
          <p className="mt-4 leading-relaxed text-muted">{c.purposeText}</p>
        </section>
        <section id="example" className="mt-14 scroll-mt-24">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">A public demo, not a perfect transcript</h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-muted">This is an unedited excerpt of recorded OCR output from our demo screenshot. Misreads and imperfect line breaks are left visible so you can see what needs checking.</p>
          <div className="mt-6 grid min-w-0 gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
            <figure className="min-w-0">
              <div role="region" aria-label="Scrollable source screenshot" tabIndex={0} className="h-80 overflow-y-auto rounded-xl border border-line focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
                <Image src={`/samples/${c.sample}.jpg`} alt={`${kind === "chat" ? "Chat conversation" : "Article"} demo screenshot used for the OCR excerpt`} width={example.width} height={example.height} sizes="(max-width: 640px) 100vw, 360px" className="h-auto w-full" />
              </div>
              <figcaption className="mt-3 text-sm text-muted">{example.width} × {example.height.toLocaleString("en-US")} pixels · <a href={`/samples/${c.sample}.jpg`} className="text-accent underline underline-offset-4">Open full source image</a></figcaption>
            </figure>
            <div className="min-w-0">
              <pre className="min-h-80 whitespace-pre-wrap break-words rounded-xl border border-line bg-wash p-5 font-mono text-sm leading-relaxed text-ink"><code>{excerpt}</code></pre>
              <p className="mt-3 text-sm text-muted">Markdown source · excerpt, not the complete result</p>
            </div>
          </div>
        </section>
        <section className="mt-14 max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">How to convert your screenshot</h2>
          <ol className="mt-6 space-y-7">
            {c.steps.map(([title, body], i) => <li key={title} className="flex gap-4"><span aria-hidden="true" className="pt-1 text-sm font-semibold text-accent">0{i + 1}</span><div><h3 className="font-semibold text-ink">{title}</h3><p className="mt-2 leading-relaxed text-muted">{body}</p></div></li>)}
          </ol>
        </section>
        <section className="mt-14 max-w-3xl border-t border-line pt-10">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">{c.reviewTitle}</h2>
          <ul className="mt-5 list-disc space-y-3 pl-5 leading-relaxed text-muted">{c.review.map(item => <li key={item}>{item}</li>)}</ul>
          <p className="mt-5 leading-relaxed text-muted">Only upload material you have the right to share. Images are sent for OCR processing; this is not an offline tool. <Link href="/privacy" className="text-accent underline underline-offset-4">Read how your content is handled</Link>.</p>
        </section>
        <section className="mt-14 max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Questions about {kind === "chat" ? "chat screenshots" : "Markdown output"}</h2>
          <div className="mt-5 divide-y divide-line border-y border-line">{c.faq.map(([q, a]) => <details key={q}><summary className="flex cursor-pointer items-center justify-between gap-5 py-5 font-medium text-ink">{q}<span aria-hidden="true" className="l2t-chevron text-xl text-accent">+</span></summary><p className="pb-5 leading-relaxed text-muted">{a}</p></details>)}</div>
        </section>
        <aside className="mt-14 border-t border-line pt-8" aria-label="Related guide">
          <p className="text-sm text-muted">Another way to use your screenshots</p>
          {seoGuides.filter(item => item.slug !== guide.slug).map(item => <Link key={item.slug} href={`/${item.slug}`} className="mt-3 inline-block text-lg font-medium text-accent underline-offset-4 hover:underline">{item.label} →</Link>)}
        </aside>
      </main>
      <SiteFooter d={dicts.en} />
    </>
  );
}
