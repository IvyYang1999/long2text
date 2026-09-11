import type { Dict } from "@/lib/i18n";
import { SITE } from "@/lib/seo";
import SiteHeader from "@/components/SiteHeader";
import Converter from "@/components/Converter";
import { Landing, SiteFooter, StructuredData } from "@/components/Landing";

export default function HomePage({ d }: { d: Dict }) {
  return (
    <>
      <StructuredData d={d} url={`${SITE}${d.home === "/" ? "" : d.home}`} />
      <SiteHeader locale={d.locale} />
      <main>
        <Converter locale={d.locale} />
        <Landing d={d} />
      </main>
      <SiteFooter d={d} />
    </>
  );
}
