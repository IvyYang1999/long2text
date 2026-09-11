import type { Metadata } from "next";
import type { Dict } from "./i18n";

export const SITE = "https://long2text.com";

/** Metadata for a page in one locale; `path` is the path within that locale ("" for home). */
export function pageMetadata(d: Dict, path = "", opts: { title?: string; description?: string; index?: boolean } = {}): Metadata {
  const en = `/${path}`.replace(/\/$/, "") || "/";
  const zh = `/zh${path ? `/${path}` : ""}`;
  const self = d.locale === "en" ? en : zh;
  const title = opts.title ?? d.meta.title;
  const description = opts.description ?? d.meta.description;
  return {
    metadataBase: new URL(SITE),
    title,
    description,
    alternates: { canonical: self, languages: { en, "zh-CN": zh, "x-default": en } },
    openGraph: {
      title: opts.title ?? d.meta.ogTitle,
      description,
      url: self,
      siteName: "Long2Text",
      type: "website",
      locale: d.locale === "en" ? "en_US" : "zh_CN",
    },
    twitter: { card: "summary_large_image", title: opts.title ?? d.meta.ogTitle, description },
    robots: opts.index === false ? { index: false, follow: false } : { index: true, follow: true },
    icons: { icon: "/icon.svg" },
  };
}
