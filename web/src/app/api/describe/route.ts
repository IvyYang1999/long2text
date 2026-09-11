import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 20;

const ENDPOINT = "https://api.siliconflow.cn/v1/chat/completions";
// Free vision model. 2026-09-11 evals (vault: 评测-2026-09-11-Qwen3.5-4B图片描述.md and the
// prompt A/B in 日志): median ≈ 0.7 s, but 8–17 % of calls stall to the timeout — the client hedges.
// The prompt forbids guessing unseen material/identity ("cookie", "moon": 11 → 3 of 24) and asks
// for the card source verbatim.
const MODEL_DEFAULT = "Qwen/Qwen3.5-4B";
const MAX_BYTES = 400_000;

const PROMPTS = {
  zh: "这是从一张聊天记录或文章长截图里裁出来的一块图片。用一句中文说明它，格式是「类型：内容」。类型从这些里选：表情包、照片、截图、链接卡片、图表、插画、文件、其他。内容不超过 30 个字，只写看得见的形状、颜色、人物动作和文字；看不出来的身份、材质、品种、意图不要猜。图里有文字就用引号照抄主要文字。带标题、摘要和来源的卡片是链接卡片，写成「链接卡片：《标题》— 来源」，来源按卡片底部原样完整照抄。只输出这一句。",
  en: "This is a picture cut out of a long screenshot of a chat or an article. Describe it in one line formatted as \"Type: content\". Type is one of: Sticker, Photo, Screenshot, Link card, Chart, Illustration, File, Other. Content is at most 20 words and only states what is visible: shapes, colours, actions and text. Do not guess identity, material, species or intent you cannot see. Quote the main text if there is any. A card with a title, a summary and a source is a link card: write \"Link card: “Title” — source\", copying the source line at the bottom of the card exactly and completely. Output only that line.",
};

/**
 * One-sentence description of one picture cropped from a screenshot.
 * Only called when the user clicks "Describe images with AI".
 * Body: { image: "data:image/jpeg;base64,…", lang: "zh" | "en" } → { text }
 */
export async function POST(request: NextRequest) {
  const key = process.env.SILICONFLOW_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "not configured" }, { status: 503 });
  let body: { image?: unknown; lang?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const image = typeof body.image === "string" ? body.image : "";
  const lang = body.lang === "en" ? "en" : "zh";
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > MAX_BYTES * 1.4) {
    return NextResponse.json({ error: "Invalid image" }, { status: 400 });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const model = process.env.SILICONFLOW_VISION_MODEL?.trim() || MODEL_DEFAULT;
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 100,
        stream: false,
        ...(/Qwen3/i.test(model) ? { enable_thinking: false } : {}),
        messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: image } }, { type: "text", text: PROMPTS[lang] }] }],
      }),
    });
    if (res.status === 429) return NextResponse.json({ error: "rate limited" }, { status: 429 });
    if (!res.ok) return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const text = raw
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .replace(/[\r\n]+/g, " ")
      .replace(/^\s*["“「](.*)["”」]\s*$/, "$1") // only when the whole line is wrapped in quotes
      .replace(/^(?:type|类型)\s*[:：]\s*([^;；,，:：]{1,20})\s*[;；,，]\s*/i, "$1: ") // "Type: Sticker; …" → "Sticker: …"
      .trim()
      .slice(0, lang === "zh" ? 80 : 180);
    if (!text) return NextResponse.json({ error: "empty" }, { status: 502 });
    return NextResponse.json({ text });
  } catch (err) {
    const reason = err instanceof Error && err.name === "AbortError" ? "timeout" : "network";
    return NextResponse.json({ error: reason }, { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}
