import Link from "next/link";
import { CONTACT_EMAIL, type Dict } from "@/lib/i18n";
import SiteHeader from "@/components/SiteHeader";
import { SiteFooter } from "@/components/Landing";

const CONTACT = CONTACT_EMAIL;
const UPDATED = "2026-09-11";

type Section = { h: string; p: string[] };
type Doc = { title: string; updated: string; sections: Section[]; contact: string };

const privacy: Record<"en" | "zh", Doc> = {
  en: {
    title: "Privacy policy",
    updated: `Last updated ${UPDATED}`,
    contact: "Questions or deletion requests:",
    sections: [
      { h: "Your screenshots", p: ["Images are split into slices in your browser. Each slice is sent to our server and passed to Tencent Cloud OCR for text recognition. Long2Text does not store your images; slices are discarded once they have been read."] },
      { h: "AI proofreading", p: ["When AI proofread is on, a small number of lines the OCR engine was unsure about — together with a few nearby lines of text — are sent to SiliconFlow's model API to fix misreads. Images are never sent. You can switch it off at any time; the setting is remembered in your browser."] },
      { h: "If you sign in", p: ["Google sign-in gives us your name, email address and profile picture, which we use only to link your purchases and history to you.", "Recognized text from images you convert while signed in is saved to our database so you can find it again in History."] },
      { h: "Payments", p: ["Payments are processed by Stripe. We receive a confirmation of the payment, never your card details."] },
      { h: "Analytics and cookies", p: ["We use Google Analytics to count visits and clicks. It is disabled when your browser sends Do Not Track or Global Privacy Control, and it never receives the text of your screenshots.", "Cookies are used for your sign-in session, your language choice and analytics."] },
    ],
  },
  zh: {
    title: "隐私政策",
    updated: `最后更新：${UPDATED}`,
    contact: "有问题或需要删除数据，请联系：",
    sections: [
      { h: "你的截图", p: ["图片在你的浏览器里被切成小段。每一段发送到我们的服务器，再交给腾讯云 OCR 识别文字。Long2Text 不保存你的图片，小段图片识别完即丢弃。"] },
      { h: "AI 校对", p: ["开启 AI 校对时，识别引擎没把握的少量文字行，连同附近几行文字，会发送给硅基流动（SiliconFlow）的模型接口用于修正错字。不会发送图片。你可以随时关掉，这个设置保存在你的浏览器里。"] },
      { h: "如果你登录", p: ["通过 Google 登录时，我们会拿到你的名字、邮箱和头像，只用来把你的购买记录和历史记录关联到你。", "登录状态下转换的图片，识别出的文字会保存在我们的数据库里，方便你之后在「历史记录」里找回。"] },
      { h: "付款", p: ["付款由 Stripe 处理。我们只收到付款成功的确认，看不到你的卡号。"] },
      { h: "统计与 Cookie", p: ["我们用 Google Analytics 统计访问和点击。浏览器开启「请勿追踪」或「全局隐私控制」时不会统计，截图里的文字也从不发送给它。", "Cookie 用于登录状态、语言选择和访问统计。"] },
    ],
  },
};

const terms: Record<"en" | "zh", Doc> = {
  en: {
    title: "Terms of service",
    updated: `Last updated ${UPDATED}`,
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
    updated: `最后更新：${UPDATED}`,
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
