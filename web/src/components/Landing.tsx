import Link from "next/link";
import { CONTACT_EMAIL, type Dict } from "@/lib/i18n";
import { IconSlices, IconBolt, IconDoc, IconChat, IconMeeting, IconArticle, IconCheck, IconLock } from "@/components/Icons";
import { Wordmark } from "@/components/Logo";
import { seoGuides } from "@/lib/seo-guides";

const stepIcons = [IconSlices, IconBolt, IconDoc];
const useIcons = { chat: IconChat, meeting: IconMeeting, article: IconArticle } as const;

/** Everything below the tool. Server-rendered so search engines read it. */
export function Landing({ d }: { d: Dict }) {
  return (
    <>
      {/* how it works */}
      <section id="how" className="scroll-mt-20 border-t border-line bg-wash/60">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight text-ink">{d.how.title}</h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {d.how.steps.map((s, i) => {
              const Icon = stepIcons[i];
              return (
                <li key={s.t} className="rounded-2xl border border-line bg-white p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-xs text-faint">0{i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-[17px] font-semibold text-ink">{s.t}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.d}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* use cases */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight text-ink">{d.uses.title}</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {d.uses.items.map((u) => {
            const Icon = useIcons[u.k as keyof typeof useIcons];
            return (
              <div key={u.k} className="p-2">
                <Icon className="h-6 w-6 text-accent" />
                <h3 className="mt-4 text-[17px] font-semibold text-ink">{u.t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{u.d}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* privacy */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="grid gap-8 rounded-3xl bg-ink px-7 py-10 text-white sm:px-12 sm:py-12 md:grid-cols-[1fr_1.3fr]">
          <div>
            <IconLock className="h-7 w-7 text-[#8fa3ff]" />
            <h2 className="mt-4 text-3xl font-bold tracking-tight">{d.privacy.title}</h2>
            <Link href={`${d.home === "/" ? "" : d.home}/privacy`} className="mt-5 inline-block text-sm text-[#b9c5ff] underline-offset-4 hover:underline">
              {d.privacy.link} →
            </Link>
          </div>
          <ul className="space-y-4">
            {d.privacy.items.map((t) => (
              <li key={t} className="flex gap-3 text-[15px] leading-relaxed text-white/80">
                <IconCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#8fa3ff]" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="scroll-mt-20 mx-auto max-w-6xl px-5 pb-20">
        <h2 className="text-center text-3xl font-bold tracking-tight text-ink">{d.pricing.title}</h2>
        <div className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-2">
          {[d.pricing.free, d.pricing.paid].map((p, i) => (
            <div key={p.name} className={`rounded-2xl p-7 ${i === 1 ? "border-2 border-accent bg-white shadow-[0_16px_40px_-20px_rgba(51,85,255,.45)]" : "border border-line bg-white"}`}>
              <h3 className="text-[15px] font-semibold text-muted">{p.name}</h3>
              <p className="mt-2 text-4xl font-bold tracking-tight text-ink">{p.price}</p>
              <ul className="mt-6 space-y-3">
                {p.items.map((t) => (
                  <li key={t} className="flex gap-2.5 text-[15px] text-ink">
                    <IconCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-accent" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 mx-auto max-w-3xl px-5 pb-24">
        <h2 className="text-center text-3xl font-bold tracking-tight text-ink">{d.faq.title}</h2>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {d.faq.items.map(([q, a]) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer items-center justify-between gap-4 py-5 text-[16px] font-medium text-ink">
                {q}
                <span className="l2t-chevron text-xl leading-none text-faint transition-transform">+</span>
              </summary>
              <p className="-mt-1 pb-5 text-[15px] leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

export function SiteFooter({ d }: { d: Dict }) {
  const base = d.home === "/" ? "" : d.home;
  return (
    <footer className="border-t border-line">
      {d.locale === "en" && (
        <nav aria-label="Conversion guides" className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-3 px-5 pt-8 text-sm text-muted">
          <span className="font-medium text-ink">Conversion guides</span>
          {seoGuides.map(guide => <Link key={guide.slug} href={`/${guide.slug}`} className="text-accent underline-offset-4 hover:underline">{guide.label}</Link>)}
        </nav>
      )}
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-faint sm:flex-row">
        <div className="flex items-center gap-3">
          <Wordmark className="scale-90" />
          <span>© 2026 · {d.footer.rights}</span>
        </div>
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-3">
          <Link href={`${base}/privacy`} className="hover:text-ink">
            {d.footer.privacy}
          </Link>
          <Link href={`${base}/terms`} className="hover:text-ink">
            {d.footer.terms}
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-ink">
            {d.footer.contact}
          </a>
          <Link href={d.other.href} hrefLang={d.other.hreflang} className="hover:text-ink">
            {d.other.label}
          </Link>
        </nav>
      </div>
    </footer>
  );
}

/** JSON-LD for the product and its FAQ. */
export function StructuredData({ d, url }: { d: Dict; url: string }) {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Long2Text",
      url,
      inLanguage: d.htmlLang,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Web",
      description: d.meta.description,
      offers: [
        { "@type": "Offer", price: "0", priceCurrency: "USD" },
        { "@type": "Offer", price: "0.99", priceCurrency: "USD" },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      inLanguage: d.htmlLang,
      mainEntity: d.faq.items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
