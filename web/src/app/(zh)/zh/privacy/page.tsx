import { dicts } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import Legal, { legalTitle } from "@/components/Legal";

export const metadata = pageMetadata(dicts.zh, "privacy", { title: `${legalTitle("zh", "privacy")} · Long2Text`, description: "了解 Long2Text 如何处理截图、OCR 识别、可选 AI 校对、账号历史记录、付款及访问统计，以及如何联系我们处理数据问题。" });

export default function Page() {
  return <Legal d={dicts.zh} kind="privacy" />;
}
