import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
    "Convert long screenshots to formatted text instantly. Specialized in chat records, meeting transcripts, and articles. Supports Chinese & English with markdown output.",
  keywords: [
    "long screenshot to text",
    "OCR",
    "image to text",
    "chat screenshot",
    "meeting transcript",
    "长截图转文字",
    "图片转文字",
    "聊天记录截图",
    "会议记录",
  ],
  openGraph: {
    title: "Long2Text - Long Screenshot OCR Expert",
    description: "Convert long screenshots to formatted text with one click.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
