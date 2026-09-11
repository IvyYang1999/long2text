import Link from "next/link";
import RootShell from "@/components/RootShell";
import { Wordmark } from "@/components/Logo";

export const metadata = { metadataBase: new URL("https://long2text.com"), title: "Not found · Long2Text", robots: { index: false } };

export default function GlobalNotFound() {
  return (
    <RootShell lang="en">
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-5 text-center">
        <Wordmark />
        <h1 className="text-2xl font-semibold text-ink">This page doesn&apos;t exist.</h1>
        <p className="text-muted">页面不存在。</p>
        <div className="flex gap-3 text-sm">
          <Link href="/" className="rounded-full bg-ink px-4 py-2 text-white">
            Long2Text
          </Link>
          <Link href="/zh" className="rounded-full border border-line px-4 py-2 text-ink">
            中文版
          </Link>
        </div>
      </main>
    </RootShell>
  );
}
