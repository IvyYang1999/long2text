import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";
import { seoGuides } from "@/lib/seo-guides";

const pages = ["", "privacy", "terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  const localized = pages.flatMap((p) => {
    const en = `${SITE}${p ? `/${p}` : ""}`;
    const zh = `${SITE}/zh${p ? `/${p}` : ""}`;
    const languages = { en, "zh-CN": zh };
    const priority = p ? 0.3 : 1;
    return [
      { url: en, changeFrequency: "weekly" as const, priority, alternates: { languages } },
      { url: zh, changeFrequency: "weekly" as const, priority, alternates: { languages } },
    ];
  });
  // Omit lastmod until we have per-page content dates, rather than claiming every build edits every page.
  return [...localized, ...seoGuides.map(({ slug }) => ({
    url: `${SITE}/${slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.8,
    alternates: { languages: { en: `${SITE}/${slug}`, "x-default": `${SITE}/${slug}` } },
  }))];
}
