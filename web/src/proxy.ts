import { NextRequest, NextResponse } from "next/server";

const BOT = /bot|crawl|spider|slurp|bing|baidu|yandex|duckduck|facebookexternalhit|embedly|preview|lighthouse/i;

/**
 * First visit to "/" from a browser whose preferred language is Chinese goes
 * to "/zh". Crawlers and anyone who picked a language (l2t-lang cookie) are
 * left alone, so search engines index both versions via hreflang.
 */
export function proxy(req: NextRequest) {
  const choice = req.cookies.get("l2t-lang")?.value;
  if (choice === "en") return NextResponse.next();
  const ua = req.headers.get("user-agent") || "";
  const primary = (req.headers.get("accept-language") || "").split(",")[0]?.trim().toLowerCase() || "";
  if (choice === "zh" || (!choice && !BOT.test(ua) && primary.startsWith("zh"))) {
    const url = req.nextUrl.clone();
    url.pathname = "/zh";
    return NextResponse.redirect(url, 307);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/"] };
