import { dicts } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import Legal, { legalTitle } from "@/components/Legal";

export const metadata = pageMetadata(dicts.zh, "privacy", { title: `${legalTitle("zh", "privacy")} · Long2Text` });

export default function Page() {
  return <Legal d={dicts.zh} kind="privacy" />;
}
