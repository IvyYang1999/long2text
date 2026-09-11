import { dicts } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import Legal, { legalTitle } from "@/components/Legal";

export const metadata = pageMetadata(dicts.en, "privacy", { title: `${legalTitle("en", "privacy")} · Long2Text` });

export default function Page() {
  return <Legal d={dicts.en} kind="privacy" />;
}
