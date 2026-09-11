import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

const pages = ["", "privacy", "terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.flatMap((p) => {
    const en = `${SITE}${p ? `/${p}` : ""}`;
    const zh = `${SITE}/zh${p ? `/${p}` : ""}`;
    const languages = { en, "zh-CN": zh };
    const priority = p ? 0.3 : 1;
    return [
      { url: en, lastModified: new Date(), changeFrequency: "weekly" as const, priority, alternates: { languages } },
      { url: zh, lastModified: new Date(), changeFrequency: "weekly" as const, priority, alternates: { languages } },
    ];
  });
}
