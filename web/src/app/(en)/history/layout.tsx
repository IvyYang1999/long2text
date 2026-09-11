import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://long2text.com"),
  title: "History · Long2Text",
  robots: { index: false, follow: false },
};

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
