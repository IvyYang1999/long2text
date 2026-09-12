import { dicts } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import Legal, { legalTitle } from "@/components/Legal";

export const metadata = pageMetadata(dicts.zh, "terms", { title: `${legalTitle("zh", "terms")} · Long2Text`, description: "阅读 Long2Text 服务条款：可上传的内容、文字识别的局限、单张结果的一次性购买，以及付费结果出现问题时的处理方式。" });

export default function Page() {
  return <Legal d={dicts.zh} kind="terms" />;
}
