import Script from "next/script";
import localFont from "next/font/local";
import { SessionProvider } from "next-auth/react";
import "@/app/globals.css";

// Geist (SIL OFL) variable fonts, self-hosted so builds never depend on Google Fonts
const geistSans = localFont({
  variable: "--font-geist-sans",
  src: [{ path: "../fonts/geist-latin.woff2", weight: "100 900", style: "normal" }],
  display: "swap",
});
const geistMono = localFont({
  variable: "--font-geist-mono",
  src: [{ path: "../fonts/geist-mono-latin.woff2", weight: "100 900", style: "normal" }],
  display: "swap",
});

/** <html>/<body> shared by the English and Chinese root layouts. */
export default function RootShell({ lang, children }: { lang: string; children: React.ReactNode }) {
  return (
    <html lang={lang}>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-white antialiased`}>
        <SessionProvider>{children}</SessionProvider>
        <Script
          src="/dc-analytics.js"
          strategy="afterInteractive"
          data-ga-id="G-CH4WNME765"
          data-site="long2text"
          data-hosts="long2text.com,www.long2text.com"
        />
      </body>
    </html>
  );
}
