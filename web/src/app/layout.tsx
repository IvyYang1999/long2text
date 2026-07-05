import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Long2Text - Long Screenshot to Text | AI-Powered OCR",
  description:
    "Convert long screenshots to formatted text instantly. Specialized in chat records, meeting transcripts, and articles. Supports Chinese & English with Markdown output.",
  keywords: [
    "long screenshot to text",
    "OCR",
    "image to text",
    "screenshot to text",
    "chat screenshot OCR",
    "meeting transcript OCR",
    "long image to text",
    "长截图转文字",
    "图片转文字",
    "聊天记录截图转文字",
    "会议记录转文字",
    "截图OCR",
    "微信聊天记录转文字",
  ],
  metadataBase: new URL("https://long2text.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Long2Text - Convert Long Screenshots to Text",
    description:
      "Upload any long screenshot and get formatted text in seconds. Perfect for chat records, meeting transcripts, and articles. Free to try.",
    type: "website",
    url: "https://long2text.com",
    siteName: "Long2Text",
  },
  twitter: {
    card: "summary_large_image",
    title: "Long2Text - Long Screenshot to Text",
    description:
      "Convert long screenshots to formatted Markdown text. Free for short texts, $0.99 per unlock.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Long2Text",
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Web",
  description:
    "Convert long screenshots to formatted text. Specialized OCR for chat records, meeting transcripts, and articles.",
  url: "https://long2text.com",
  offers: [
    {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free tier - full result for short texts",
    },
    {
      "@type": "Offer",
      price: "0.99",
      priceCurrency: "USD",
      description: "Unlock full result for one long screenshot",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
