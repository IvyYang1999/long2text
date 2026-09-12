import Link from "next/link";
import { CONTACT_EMAIL, type Dict } from "@/lib/i18n";
import SiteHeader from "@/components/SiteHeader";
import { SiteFooter } from "@/components/Landing";
import AnalyticsPreference from "@/components/AnalyticsPreference";

const CONTACT = CONTACT_EMAIL;
const UPDATED = "2026-09-12";

type Section = { h: string; p: string[] };
type Doc = { title: string; updated: string; sections: Section[]; contact: string };

const privacy: Record<"en" | "zh", Doc> = {
  en: {
    title: "Privacy policy",
    updated: `Last updated ${UPDATED}`,
    contact: "Questions or deletion requests:",
    sections: [
      { h: "Your screenshots", p: ["Your screenshot is sent through our server to Google Cloud Vision for text recognition. Large images may be split in your browser. Tencent Cloud OCR is available as an alternative provider when configured. Long2Text does not store your images; they are processed in memory and discarded after recognition."] },
      { h: "AI proofreading", p: ["When AI proofread is on, a small number of lines the OCR engine was unsure about — together with a few nearby lines of text — are sent to SiliconFlow's model API to fix misreads. You can switch it off at any time; the setting is remembered in your browser.", "Pictures found in your screenshot (stickers, photos) are cut out in your browser. Only if you click “Describe them with AI” are those small crops sent to SiliconFlow's vision model to get a one-line description; the full screenshot is never sent."] },
      { h: "If you sign in", p: ["Google sign-in gives us your name, email address and profile picture, which we use only to link your purchases and history to you.", "Recognized text from images you convert while signed in is saved to our database so you can find it again in History."] },
      { h: "Payments", p: ["Payments are processed by Stripe. We receive a confirmation of the payment, never your card details."] },
      { h: "Analytics and cookies", p: ["Optional Google Analytics is off by default. You can enable it using the preference below and disable it here later. Do Not Track, Global Privacy Control and an existing refusal keep it off. We do not load Google Analytics before your opt-in.", "When enabled, it measures public-page visits, visible pricing/paywalls, sign-in attempts and successful returns, conversion outcomes and duration ranges, input methods, preview versus full exports, checkout attempts and verified payment returns. It does not receive screenshot content, file names, account or payment identifiers, or raw error messages. These statistics describe consenting visitors only and are not our payment ledger.", "We discard raw URL queries and full referring URLs. Only predefined source labels (such as Reddit or Discord) and campaign labels are accepted. After opt-in, these labels can persist in this tab for up to 30 minutes, and an identifier-free login-attempt marker for up to 15 minutes. Revoking analytics clears these markers. Attribution starts after consent; it cannot recover earlier visits.", "Necessary cookies support sign-in and language choice. Optional analytics cookies are used only after you enable analytics; your preference is stored locally in this browser."] },
    ],
  },
  zh: {
    title: "隐私政策",
    updated: `最后更新：${UPDATED}`,
    contact: "有问题或需要删除数据，请联系：",
    sections: [
      { h: "你的截图", p: ["截图通过我们的服务器交给 Google Cloud Vision 识别文字。较大的图片可能在浏览器里分段；配置切换时也可使用腾讯云 OCR。Long2Text 不保存你的图片，图片仅在内存中处理，识别后即丢弃。"] },
      { h: "AI 校对", p: ["开启 AI 校对时，识别引擎没把握的少量文字行，连同附近几行文字，会发送给硅基流动（SiliconFlow）的模型接口用于修正错字。你可以随时关掉，这个设置保存在你的浏览器里。", "截图里的表情包、照片等配图在你的浏览器里被裁出来。只有你点击「让 AI 描述这些图片」时，这些小图才会发送给硅基流动的视觉模型生成一句描述；整张截图不会被发送。"] },
      { h: "如果你登录", p: ["通过 Google 登录时，我们会拿到你的名字、邮箱和头像，只用来把你的购买记录和历史记录关联到你。", "登录状态下转换的图片，识别出的文字会保存在我们的数据库里，方便你之后在「历史记录」里找回。"] },
      { h: "付款", p: ["付款由 Stripe 处理。我们只收到付款成功的确认，看不到你的卡号。"] },
      { h: "统计与 Cookie", p: ["可选的 Google Analytics 默认关闭。你可以通过下方选项主动开启，之后也可以在这里关闭。「请勿追踪」、全局隐私控制和已有拒绝记录会使统计保持关闭；主动同意前不会加载 Google Analytics。", "开启后，统计公开页面访问、可见的价格与付费墙、登录尝试及成功返回、转换结果和耗时区间、输入方式、预览与完整导出、结账尝试及已核验的付款返回。不发送截图正文、文件名、账号或付款标识，也不发送原始错误信息。数据只代表同意统计的访客，不是全站用户统计或财务账本。", "原始网址查询参数和完整来源网址会被丢弃，只接受预先定义的来源标签（如 Reddit、Discord）和活动标签。主动同意后，来源标签可在当前标签页保留最多 30 分钟，不含身份信息的登录尝试标记最多保留 15 分钟；关闭统计会清除这些标记。归因从同意后开始，不能恢复更早的访问来源。", "必要 Cookie 用于登录状态和语言选择。只有主动开启统计后才使用可选统计 Cookie；你的选择仅保存在当前浏览器。"] },
    ],
  },
};

const terms: Record<"en" | "zh", Doc> = {
  en: {
    title: "Terms of service",
    updated: "Last updated 2026-09-11",
    contact: "Contact:",
    sections: [
      { h: "The service", p: ["Long2Text converts screenshots you provide into text. Recognition and AI proofreading can make mistakes; please check important results against the original image."] },
      { h: "Your content", p: ["Only upload images you have the right to use. Don't upload content that is illegal or that you are not allowed to share. You keep all rights to your images and the text extracted from them."] },
      { h: "Payments", p: ["Unlocking a result is a one-time payment for that image, not a subscription. If a paid result is broken, contact us and we will refund it."] },
      { h: "Changes", p: ["We may update the service and these terms. Continued use after a change means you accept the updated terms."] },
    ],
  },
  zh: {
    title: "服务条款",
    updated: "最后更新：2026-09-11",
    contact: "联系方式：",
    sections: [
      { h: "服务内容", p: ["Long2Text 把你提供的截图转换成文字。识别和 AI 校对都可能出错，重要内容请对照原图核对。"] },
      { h: "你的内容", p: ["请只上传你有权使用的图片，不要上传违法或你无权分享的内容。图片以及从中提取的文字，所有权利都归你。"] },
      { h: "付款", p: ["解锁结果是针对这一张图的一次性付款，不是订阅。付费后结果有问题，联系我们即可退款。"] },
      { h: "变更", p: ["我们可能会更新服务和本条款。条款更新后继续使用，即表示你接受更新后的条款。"] },
    ],
  },
};

export default function Legal({ d, kind }: { d: Dict; kind: "privacy" | "terms" }) {
  const doc = (kind === "privacy" ? privacy : terms)[d.locale];
  return (
    <>
      <SiteHeader locale={d.locale} />
      <main className="mx-auto max-w-2xl px-5 py-16">
        <Link href={d.home} className="text-sm text-muted hover:text-ink">
          ← Long2Text
        </Link>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-ink">{doc.title}</h1>
        <p className="mt-2 text-sm text-faint">{doc.updated}</p>
        <div className="mt-10 space-y-9">
          {doc.sections.map((s) => (
            <section key={s.h}>
              <h2 className="text-lg font-semibold text-ink">{s.h}</h2>
              {s.p.map((t) => (
                <p key={t} className="mt-2 text-[15px] leading-relaxed text-muted">
                  {t}
                </p>
              ))}
            </section>
          ))}
          {kind === "privacy" && <AnalyticsPreference locale={d.locale} />}
          {CONTACT && (
            <p className="text-[15px] text-muted">
              {doc.contact}{" "}
              <a href={`mailto:${CONTACT}`} className="text-accent underline-offset-4 hover:underline">
                {CONTACT}
              </a>
            </p>
          )}
        </div>
      </main>
      <SiteFooter d={d} />
    </>
  );
}

export const legalTitle = (locale: "en" | "zh", kind: "privacy" | "terms") => (kind === "privacy" ? privacy : terms)[locale].title;
