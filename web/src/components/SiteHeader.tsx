"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { Wordmark } from "@/components/Logo";
import { dicts, type Locale } from "@/lib/i18n";

export default function SiteHeader({ locale }: { locale: Locale }) {
  const d = dicts[locale];
  const { data: session } = useSession();
  const setLangCookie = () => {
    document.cookie = `l2t-lang=${d.other.href === "/zh" ? "zh" : "en"}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href={d.home} aria-label="Long2Text">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-1 text-sm text-muted sm:gap-2">
          <a href={`${d.home}#how`} className="hidden rounded-full px-3 py-1.5 hover:text-ink md:block">
            {d.nav.how}
          </a>
          <a href={`${d.home}#pricing`} className="hidden rounded-full px-3 py-1.5 hover:text-ink sm:block">
            {d.nav.pricing}
          </a>
          <Link href={d.other.href} hrefLang={d.other.hreflang} onClick={setLangCookie} className="rounded-full px-3 py-1.5 hover:text-ink">
            {d.other.label}
          </Link>
          {session?.user ? (
            <>
              <Link href="/history" className="rounded-full px-3 py-1.5 hover:text-ink">
                {d.nav.history}
              </Link>
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt="" className="ml-1 h-7 w-7 rounded-full border border-line" />
              ) : null}
              <button onClick={() => signOut()} className="rounded-full px-2 py-1.5 text-xs text-faint hover:text-ink">
                {d.nav.signOut}
              </button>
            </>
          ) : (
            <button
              onClick={() => signIn("google")}
              data-ga-click="login_click"
              className="ml-1 rounded-full border border-line px-4 py-1.5 font-medium text-ink transition hover:border-ink"
            >
              {d.nav.signIn}
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
