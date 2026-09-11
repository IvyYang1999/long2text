import { dicts } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import HomePage from "@/components/HomePage";

export const metadata = pageMetadata(dicts.en);

export default function Page() {
  return <HomePage d={dicts.en} />;
}
