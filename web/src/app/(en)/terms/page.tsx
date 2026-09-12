import { dicts } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import Legal, { legalTitle } from "@/components/Legal";

export const metadata = pageMetadata(dicts.en, "terms", { title: `${legalTitle("en", "terms")} · Long2Text`, description: "Read the Long2Text terms of service, including permitted content, recognition limitations, one-time result purchases and support for broken paid results." });

export default function Page() {
  return <Legal d={dicts.en} kind="terms" />;
}
