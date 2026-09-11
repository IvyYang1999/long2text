/** All user-facing copy, one dictionary per locale. "/" is English, "/zh" is Chinese. */
export type Locale = "en" | "zh";

export const FREE_CHARS = 500;
export const CONTACT_EMAIL = "support@long2text.com";
export const PREVIEW_PERCENT = 30;

const en = {
  locale: "en" as Locale,
  htmlLang: "en",
  home: "/",
  other: { href: "/zh", label: "中文", hreflang: "zh-CN" },
  meta: {
    title: "Long Screenshot to Text — Free OCR for Chats, Meetings & Articles | Long2Text",
    description:
      "Convert long screenshots into clean, copyable text. Long2Text splits tall images, reads them in parallel and rebuilds paragraphs, speakers and timestamps. Free to try, results in about 15 seconds, images never stored.",
    ogTitle: "Long2Text — long screenshots to clean text",
  },
  nav: { how: "How it works", pricing: "Pricing", faq: "FAQ", history: "History", signIn: "Sign in", signOut: "Sign out" },
  hero: {
    eyebrow: "Free to try · Images never stored · Results in ~15 seconds",
    title1: "Turn long screenshots",
    title2: "into clean text",
    sub: "Chat logs, meeting notes and long articles — split, read and stitched back into paragraphs with speakers and timestamps. Usually in under 20 seconds.",
  },
  upload: {
    button: "Upload screenshot",
    hintBefore: "or drop a file, or paste with",
    dropNow: "Drop to convert",
    formats: "PNG, JPG or WEBP · any length",
    badFile: "Please choose an image file (PNG, JPG or WEBP).",
    samplesLabel: "No image? Try one:",
    samples: { chat: "Chat", meeting: "Meeting", article: "Article" },
  },
  demo: {
    appName: "Team chat",
    output: "Markdown",
    msgs: [
      { who: "Anna", time: "09:41", text: "Can we move the design review to Friday?" },
      { who: "Me", time: "09:42", text: "Sure — I'll update the deck tonight." },
      { who: "Anna", time: "09:42", text: "Great. Please bring the Q3 numbers too." },
    ],
    more: [
      { who: "Me", text: "Will do. Room 7B, 2 pm?" },
      { who: "Anna", text: "Perfect. I'll invite Leo as well." },
      { who: "Anna", text: "He has the feedback from the client call." },
      { who: "Me", text: "Nice, that saves us a meeting 😄" },
      { who: "Anna", text: "See you Friday!" },
    ],
  },
  work: {
    splitting: "Preparing slices…",
    reading: (done: number, total: number) => `Reading ${done} of ${total} slices`,
    eta: (s: number) => `about ${s}s left`,
    zooming: "re-reading small text at 2×",
    streaming: "Text appears here as each slice is read",
    newImage: "New image",
    failed: (list: string) => `Slice ${list} could not be read`,
    detected: { chat: "Chat", meeting: "Meeting", article: "Article" },
    units: { chat: "messages", meeting: "turns", article: "paragraphs" },
    chars: "characters",
    slices: "slices",
    seconds: (s: number) => `${s}s`,
    layout: "Layout",
    scenes: { general: "Auto", chat: "Chat", meeting: "Meeting", article: "Article" },
    ai: "AI proofread",
    aiRunning: (k: number, n: number) => `Proofreading ${k}/${n}`,
    aiNone: "Proofread · nothing to fix",
    copy: "Copy Markdown",
    copyPreview: "Copy preview",
    copied: "Copied",
    download: "Download .md",
    downloadPreview: "Download preview",
    original: "Original",
    showOriginal: "Show original image",
    hideOriginal: "Hide original image",
    recognitionFailed: "Recognition failed. Please try again.",
    me: "Me",
    them: "Them",
  },
  fix: {
    title: (n: number) => `AI restored ${n} ${n === 1 ? "spot" : "spots"} from context`,
    desc: "These were probably misread — or already misspelled in the screenshot. The restored wording is used by default; switch any of them back to what the image literally reads.",
    useImage: "Use image text",
    useRestored: "Use restored",
    allImage: "Use image text everywhere",
    allRestored: "Restore all",
    hover: (was: string) => `Restored by AI. Image text: “${was}”. Click to switch back.`,
  },
  paywall: {
    head: (p: number) => `That's the first ${p}%.`,
    full: (chars: number, blocks: number, unit: string) => `Full result: ${chars} characters · ${blocks} ${unit}`,
    unlock: "Unlock this image — $0.99",
    signInUnlock: "Sign in to unlock — $0.99",
    fine: "One-time payment · Secured by Stripe · Kept in your history",
  },
  how: {
    title: "How it works",
    steps: [
      { t: "Split in your browser", d: "Tall images are cut into overlapping slices on your device, so nothing is lost at the seams." },
      { t: "Read in parallel", d: "All slices are recognized at once. Tiny text gets a second, zoomed-in pass." },
      { t: "Rebuilt as a document", d: "Lines become paragraphs, chats get speakers and timestamps, and AI fixes obvious misreads — showing you every change." },
    ],
  },
  uses: {
    title: "Made for the screenshots you actually have",
    items: [
      { k: "chat", t: "Chat history", d: "WeChat, WhatsApp, Telegram or Slack scrolls — with who said what, and when." },
      { k: "meeting", t: "Meeting notes", d: "Transcripts from Zoom, Teams or Feishu Minutes that you can only screenshot." },
      { k: "article", t: "Articles & threads", d: "Long posts and web pages, with headings and lists kept in Markdown." },
    ],
  },
  privacy: {
    title: "Your screenshots stay yours",
    items: [
      "Images are never stored. Slices go to the OCR engine for recognition and are discarded.",
      "No account needed to try. Sign in only to unlock a result and keep your history.",
      "AI proofreading sends a few uncertain lines of text — never the image — and can be switched off.",
      "Payments are handled by Stripe. We never see your card.",
    ],
    link: "Read the privacy policy",
  },
  pricing: {
    title: "Simple pricing",
    free: { name: "Free", price: "$0", items: ["Unlimited conversions", `Full text for images under ${FREE_CHARS} characters`, `First ${PREVIEW_PERCENT}% of longer results`] },
    paid: { name: "Unlock one image", price: "$0.99", items: ["The full result for that image", "Copy & download Markdown", "Kept in your history", "No subscription"] },
  },
  faq: {
    title: "Questions",
    items: [
      ["How long can the screenshot be?", "There's no limit. The image is split in your browser, every slice is recognized, and the pieces are merged by position so nothing is lost where they meet."],
      ["How long does it take?", "Most screenshots finish in about 10–20 seconds, and text starts showing up while it's being read. AI proofreading runs afterwards in the background."],
      ["What does AI proofread change?", "Only lines the OCR engine was unsure about, or names that disagree with the rest of the image. It fixes misreads when the context supports it, never rewrites sentences or touches numbers, and highlights every change so you can switch it back."],
      ["What does “Layout” do?", "Auto detects whether it's a chat, a meeting transcript or an article. Chats get speakers and timestamps, articles get headings and merged paragraphs. You can switch after recognition without uploading again."],
      ["Which languages work?", "Chinese, English and mixed text work best. Other languages have basic support."],
      ["Is it free?", `Images under ${FREE_CHARS} characters are completely free. For longer ones you see the first ${PREVIEW_PERCENT}% for free and can unlock that image for $0.99.`],
    ] as [string, string][],
  },
  footer: { privacy: "Privacy", terms: "Terms", history: "History", rights: "All rights reserved.", contact: "Contact" },
};

type Dict = typeof en;

const zh: Dict = {
  locale: "zh",
  htmlLang: "zh-CN",
  home: "/zh",
  other: { href: "/", label: "EN", hreflang: "en" },
  meta: {
    title: "长截图转文字 — 聊天记录、会议纪要、长文章截图一键提取文字 | Long2Text",
    description:
      "在线把长截图转成可复制的文字：自动切分超长图片、并行识别，再拼回段落、说话人和时间，可导出 Markdown。免费试用，十几秒出结果，图片不保存。",
    ogTitle: "Long2Text — 长截图转文字",
  },
  nav: { how: "怎么做到的", pricing: "价格", faq: "常见问题", history: "历史记录", signIn: "登录", signOut: "退出" },
  hero: {
    eyebrow: "免费试用 · 图片不保存 · 十几秒出结果",
    title1: "长截图转文字",
    title2: "段落和说话人都还在",
    sub: "聊天记录、会议纪要、长文章都行。自动切成小段识别，再拼回带说话人和时间的完整段落，一般十几秒就好。",
  },
  upload: {
    button: "上传长截图",
    hintBefore: "也可以拖进来，或者直接粘贴",
    dropNow: "松手开始识别",
    formats: "PNG、JPG、WEBP · 多长都行",
    badFile: "请选择图片文件（PNG、JPG 或 WEBP）。",
    samplesLabel: "手边没图？试试这些：",
    samples: { chat: "聊天记录", meeting: "会议纪要", article: "长文章" },
  },
  demo: {
    appName: "项目群",
    output: "Markdown",
    msgs: [
      { who: "王老师", time: "09:41", text: "评审能挪到周五吗？" },
      { who: "我", time: "09:42", text: "可以，我今晚把方案改好。" },
      { who: "王老师", time: "09:42", text: "好，记得带上三季度的数据。" },
    ],
    more: [
      { who: "我", text: "好的，7 楼会议室，下午两点？" },
      { who: "王老师", text: "行，我把小赵也拉上。" },
      { who: "王老师", text: "他有客户那边的反馈。" },
      { who: "我", text: "太好了，省得再开一次会 😄" },
      { who: "王老师", text: "周五见！" },
    ],
  },
  work: {
    splitting: "正在切分图片…",
    reading: (done: number, total: number) => `已识别 ${done} / ${total} 段`,
    eta: (s: number) => `还要约 ${s} 秒`,
    zooming: "小字正在放大重认",
    streaming: "每识别完一段，文字就会出现在这里",
    newImage: "换一张",
    failed: (list: string) => `第 ${list} 段没能识别`,
    detected: { chat: "聊天记录", meeting: "会议记录", article: "文章" },
    units: { chat: "条消息", meeting: "段发言", article: "个段落" },
    chars: "字",
    slices: "段",
    seconds: (s: number) => `${s} 秒`,
    layout: "排版",
    scenes: { general: "自动", chat: "聊天", meeting: "会议", article: "文章" },
    ai: "AI 校对",
    aiRunning: (k: number, n: number) => `AI 校对中 ${k}/${n}`,
    aiNone: "AI 校对：没有要改的",
    copy: "复制 Markdown",
    copyPreview: "复制预览",
    copied: "已复制",
    download: "下载 .md",
    downloadPreview: "下载预览",
    original: "原图",
    showOriginal: "查看原图",
    hideOriginal: "收起原图",
    recognitionFailed: "识别失败，请稍后再试。",
    me: "我",
    them: "对方",
  },
  fix: {
    title: (n: number) => `AI 按上下文还原了 ${n} 处`,
    desc: "这些地方可能是识别错了，也可能原图本身就是错别字。默认使用还原后的写法，你可以逐处改回图片上识别到的原文。",
    useImage: "改回原图",
    useRestored: "用还原",
    allImage: "全部改回原图",
    allRestored: "全部还原",
    hover: (was: string) => `AI 还原。图片原文：「${was}」，点击改回`,
  },
  paywall: {
    head: (p: number) => `以上是前 ${p}%`,
    full: (chars: number, blocks: number, unit: string) => `全文共 ${chars} 字 · ${blocks} ${unit}`,
    unlock: "解锁这张图 · $0.99",
    signInUnlock: "登录后解锁 · $0.99",
    fine: "一次性付款 · Stripe 安全支付 · 自动存进历史记录",
  },
  how: {
    title: "怎么做到的",
    steps: [
      { t: "在浏览器里切分", d: "超长图片在你的设备上切成互相重叠的小段，切口处不丢字。" },
      { t: "所有小段同时识别", d: "几十段并行识别；字太小的地方会自动放大再认一遍。" },
      { t: "拼回成一篇文档", d: "按行距合并成段落，聊天记录标出说话人和时间；AI 按上下文修正明显的错字，每一处都标给你看。" },
    ],
  },
  uses: {
    title: "专门对付你手里的那些长截图",
    items: [
      { k: "chat", t: "聊天记录", d: "微信、QQ、钉钉、飞书的长截图，保留谁说了什么、什么时候说的。" },
      { k: "meeting", t: "会议纪要", d: "飞书妙记、腾讯会议、Zoom 的转写只能截图？直接变回文字。" },
      { k: "article", t: "长文章", d: "公众号、小红书、网页长图，标题和列表都用 Markdown 保留下来。" },
    ],
  },
  privacy: {
    title: "你的截图，只属于你",
    items: [
      "图片不保存。小段图片只发给识别引擎处理，处理完即丢弃。",
      "不注册也能用。只有解锁结果、保存历史时才需要登录。",
      "AI 校对只发送少量没把握的文字行，从不发送图片，也可以随时关掉。",
      "付款由 Stripe 处理，我们看不到你的卡号。",
    ],
    link: "查看隐私政策",
  },
  pricing: {
    title: "价格很简单",
    free: { name: "免费", price: "$0", items: ["不限次数", `${FREE_CHARS} 字以内的图片：完整结果`, `更长的图片：免费看前 ${PREVIEW_PERCENT}%`] },
    paid: { name: "解锁一张图", price: "$0.99", items: ["这张图的完整结果", "复制、下载 Markdown", "存进历史记录", "不是订阅"] },
  },
  faq: {
    title: "常见问题",
    items: [
      ["支持多长的截图？", "没有上限。图片在你的浏览器里被切成多段，逐段识别后按位置拼回去，切口处不会丢字。"],
      ["要等多久？", "大多数截图 10 到 20 秒就能识别完，识别过程中文字会陆续出现。AI 校对在识别完之后于后台进行，不耽误你先看结果。"],
      ["AI 校对会改什么？", "只看识别引擎没把握的行，以及和全文写法对不上的名字。有上下文依据才改，不改写句子、不动数字，每一处改动都会高亮，点一下就能改回原图。"],
      ["「排版」是做什么的？", "自动模式会判断是聊天记录、会议记录还是文章。聊天记录会标出说话人和时间，文章会识别标题并合并段落。识别完可以随时切换，不用重新上传。"],
      ["支持哪些语言？", "中文、英文以及中英混排效果最好，其他语言有基本支持。"],
      ["收费吗？", `${FREE_CHARS} 字以内的图片完全免费。更长的图片免费看前 ${PREVIEW_PERCENT}%，付 $0.99 解锁这一张的全文。`],
    ],
  },
  footer: { privacy: "隐私政策", terms: "服务条款", history: "历史记录", rights: "保留所有权利。", contact: "联系我们" },
};

export const dicts: Record<Locale, Dict> = { en, zh };
export type { Dict };
