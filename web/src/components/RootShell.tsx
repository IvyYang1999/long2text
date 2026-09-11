import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import "@/app/globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
