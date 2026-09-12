import { dicts } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import Legal, { legalTitle } from "@/components/Legal";

export const metadata = pageMetadata(dicts.en, "privacy", { title: `${legalTitle("en", "privacy")} · Long2Text`, description: "How Long2Text handles screenshots, OCR processing, optional AI proofreading, account history, payments and analytics. Contact us about your data." });

export default function Page() {
  return <Legal d={dicts.en} kind="privacy" />;
}
