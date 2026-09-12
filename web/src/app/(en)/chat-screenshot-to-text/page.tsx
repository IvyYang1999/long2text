import ConversionGuide from "@/components/ConversionGuide";
import { dicts } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import { seoGuides } from "@/lib/seo-guides";

const guide = seoGuides[0];
export const metadata = pageMetadata(dicts.en, guide.slug, { ...guide, locales: ["en"] });

export default function Page() {
  return <ConversionGuide kind="chat" />;
}
