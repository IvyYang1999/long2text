import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { SiteFooter } from "@/components/Landing";
import { dicts } from "@/lib/i18n";
import { pageMetadata, SITE } from "@/lib/seo";
import { comparison } from "@/lib/seo-comparison";

export const metadata = pageMetadata(dicts.en, comparison.slug, { ...comparison, locales: ["en"] });
const evidence = "/research/screenshot-markdown-2026-09-12";
const link = "text-accent underline underline-offset-4";
const section = "mt-12 scroll-mt-24 space-y-4 border-t border-line pt-8";
const heading = "text-2xl font-semibold tracking-tight text-ink";
const samples = [
  { id: "en-chat", name: "Conversation", size: "750 × 7146 pixels · 418,394 bytes", hash: "72cd3c9f5cc08ae67e088d612bd6e9e35a84b56bbd5b7964f6bc5aac62e0e977" },
  { id: "en-article", name: "Article", size: "828 × 3570 pixels · 306,131 bytes", hash: "2bd759ca096cbf63b41b35db8bc46870afdeb3c582e9b5a824d471aae429561a" },
];

export default function Page() {
  const schema = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Long2Text", item: SITE },
      { "@type": "ListItem", position: 2, name: comparison.label, item: `${SITE}/${comparison.slug}` },
    ],
  };
  return <>
    <a href="#article" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Skip to article</a>
    <SiteHeader locale="en" />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    <main id="article" tabIndex={-1} className="mx-auto max-w-3xl scroll-mt-24 px-5 py-12 text-muted sm:py-20">
      <nav aria-label="Breadcrumb" className="text-sm"><Link href="/" className={link}>Long2Text</Link><span aria-hidden="true"> / </span><span aria-current="page">Tool test</span></nav>
      <article className="leading-relaxed">
        <header>
          <p className="mt-8 text-sm font-medium text-accent">FIELD NOTES · <time dateTime="2026-09-12">September 12, 2026</time></p>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">Long screenshots to Markdown: what two samples actually showed</h1>
          <p className="mt-5 text-lg">A well-formatted summary is not a transcript. We tried three public tools with the same conversation and article screenshots, then looked at what we could actually reuse.</p>
          <p className="mt-6 rounded-2xl border border-line bg-wash p-5 text-sm"><strong className="text-ink">Disclosure:</strong> Written by the Long2Text team; this is not an independent review. Both inputs are our existing public demo images, not an independent benchmark corpus. The article image includes our own product claims; those claims are not evidence of performance. We include our own errors below.</p>
        </header>

        <section className={section} aria-labelledby="takeaway">
          <h2 id="takeaway" className={heading}>The short answer</h2>
          <p>Keep returned readable descriptions and summaries for both images, rather than a full transcript. ScreenshotsTo returned a service error on both attempts. Long2Text returned copyable transcript previews, but those previews still needed structural cleanup.</p>
          <p>This is a small workflow check, not a leaderboard. Two English demo images cannot establish which product is most accurate, fastest or best for every document.</p>
        </section>

        <section className={section} aria-labelledby="inputs">
          <h2 id="inputs" className={heading}>Try the exact same inputs</h2>
          <p>We submitted the original JPEG files without resizing or cropping them differently for each tool. Neither file contains a private customer conversation.</p>
          <div className="grid gap-4 sm:grid-cols-2">{samples.map(sample => <div key={sample.id} className="min-w-0 rounded-2xl border border-line p-5">
            <h3 className="font-semibold text-ink">{sample.name}</h3>
            <p className="mt-2 text-sm">{sample.size}</p>
            <a className={`${link} mt-3 inline-block py-2`} href={`/samples/${sample.id}.jpg`}>Open original {sample.name.toLowerCase()} image</a>
            <details className="mt-3 text-xs"><summary className="cursor-pointer py-2">SHA-256 file fingerprint</summary><code className="block break-all pb-2">{sample.hash}</code></details>
          </div>)}</div>
        </section>

        <section className={section} aria-labelledby="keep">
          <h2 id="keep" className={heading}>Keep: a description, not the original wording</h2>
          <p>We used <a href="https://keep.md/tools/screenshot-to-markdown" className={link}>Keep’s public screenshot-to-Markdown converter</a>, without signing in, once per image. Both conversions finished and produced Markdown.</p>
          <ul className="list-disc space-y-3 pl-5">
            <li><strong className="text-ink">Conversation:</strong> the output grouped the subject matter into themes and described bubbles and illustrations. It did not reproduce the sequence of messages or identify their speakers.</li>
            <li><strong className="text-ink">Article:</strong> the output summarized the sections and described the illustration. It did not preserve the original paragraphs. It also changed the caption’s wording from “ten screens tall” to “ten times tall”.</li>
            <li><strong className="text-ink">Pictures:</strong> both outputs described visual elements; neither contained Markdown image references to extracted image files.</li>
          </ul>
          <p>These outputs may be useful as an overview. They did not satisfy this test’s requirement to preserve the source text. We did not test other Keep workflows or crop variants, and did not verify the separate downloaded file.</p>
          <p className="flex flex-wrap gap-x-6 gap-y-3"><a href={`${evidence}/keep-en-chat.raw.md`} className={link} download>Chat output (.md)</a><a href={`${evidence}/keep-en-article.raw.md`} className={link} download>Article output (.md)</a></p>
        </section>

        <section className={section} aria-labelledby="screenshots-to">
          <h2 id="screenshots-to" className={heading}>ScreenshotsTo: no output to score</h2>
          <p>We uploaded each file to <a href="https://screenshotsto.com/screenshot-to-markdown" className={link}>ScreenshotsTo’s Markdown tool</a> and selected Generate Markdown. On each attempt, the page displayed:</p>
          <blockquote className="border-l-2 border-accent pl-5 font-medium text-ink">Unable to reach the AI service.</blockquote>
          <p>We did not receive Markdown. This is a record of two unsuccessful attempts in our browser session, not a diagnosis of the cause or a claim about the tool’s general availability or recognition quality. No accuracy score or export verdict is possible from these attempts.</p>
        </section>

        <section className={section} aria-labelledby="long2text">
          <h2 id="long2text" className={heading}>Long2Text: a transcript preview with cleanup still needed</h2>
          <p>We uploaded the same files through the live site in fresh anonymous browser sessions, with optional AI proofreading off. We tested the free preview only: no login or purchase, and no access to the paid remainder.</p>
          <ul className="list-disc space-y-3 pl-5">
            <li><strong className="text-ink">Conversation:</strong> the copied preview retained the opening message sequence and used Maya/Me labels. But it incorrectly treated the date divider as a message from Me. A speaker label in Markdown is not proof that attribution is correct.</li>
            <li><strong className="text-ink">Article:</strong> the opening paragraph was transcribed, but the wrapped title was split between a heading and body text, with the byline joined to the second line. The title needs manual repair.</li>
            <li><strong className="text-ink">Pictures:</strong> these copied previews contained image placeholders, not usable Markdown image links. That does not establish the behavior of a paid image bundle.</li>
          </ul>
          <p>The previews contained 783 characters for the chat and 396 for the article, before adding a final newline to the evidence files. Their cutoffs are an access limit, not evidence that the OCR omitted the remainder. Full-text accuracy, the ending of each fresh conversion and paid exports remain untested here.</p>
          <p className="flex flex-wrap gap-x-6 gap-y-3"><a href={`${evidence}/long2text-en-chat.preview.md`} className={link} download>Copied chat preview (.md)</a><a href={`${evidence}/long2text-en-article.preview.md`} className={link} download>Copied article preview (.md)</a></p>
          <p>Our guides also offer <Link href="/chat-screenshot-to-text#example" className={link}>a recorded chat example</Link> and <Link href="/screenshot-to-markdown#example" className={link}>a recorded article example</Link>, including downloadable bundles. Those are cached examples, not fresh full outputs from this comparison. <Link href="/#pricing" className={link}>Check current access and pricing</Link> before converting your own files.</p>
        </section>

        <section className={section} aria-labelledby="method">
          <h2 id="method" className={heading}>What we measured—and what we did not</h2>
          <ul className="list-disc space-y-3 pl-5">
            <li>One conversion per image per tool on September 12, 2026. No repeated runs to select a better answer, private images, paid upgrades or quota workarounds.</li>
            <li>Keep files preserve the displayed Markdown text; Long2Text files preserve the copied free preview. Only a terminal newline was added where needed. ScreenshotsTo produced no output artifact.</li>
            <li>We visually checked source wording and structure against the available output. There is no manually verified full reference transcript, so we do not report character-accuracy percentages.</li>
            <li><strong className="text-ink">No speed ranking:</strong> we did not capture comparable conversion timing boundaries across all three tools. Upload, processing, preview and paid export are different milestones.</li>
            <li>Optional Long2Text proofreading was off. We did not establish equivalent models, settings or preprocessing in the other tools.</li>
            <li>We did not verify an Obsidian import, paid downloads, handwriting, formulas, complex tables or multilingual accuracy.</li>
          </ul>
        </section>

        <section className={section} aria-labelledby="checklist">
          <h2 id="checklist" className={heading}>How to judge your own screenshot-to-Markdown result</h2>
          <ol className="list-decimal space-y-3 pl-5">
            <li><strong className="text-ink">Check wording before appearance.</strong> Compare a sentence near the top, middle and end. If you only have a preview, you cannot check the full document yet.</li>
            <li><strong className="text-ink">Check structure.</strong> Look for date dividers assigned to speakers, split titles, repeated lines and merged paragraphs. Review names and numbers especially carefully.</li>
            <li><strong className="text-ink">Check the actual export.</strong> A picture description or an image placeholder is not an image file. Open the Markdown in your destination editor and verify linked images before relying on it.</li>
            <li><strong className="text-ink">Match the tool to the job.</strong> A summary can help you understand an image; a transcript is needed to reuse its wording. When original text is available, copy or export it instead of introducing OCR errors.</li>
          </ol>
          <p>For the next step, use the <Link href="/screenshot-to-markdown" className={link}>screenshot-to-Markdown workflow</Link> or the <Link href="/chat-screenshot-to-text" className={link}>chat transcript guide</Link>. Keep the source image alongside any text you need to verify.</p>
        </section>
      </article>
    </main>
    <SiteFooter d={dicts.en} />
  </>;
}
