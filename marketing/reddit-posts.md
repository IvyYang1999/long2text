# Long2Text 推广帖子（直接复制发布）

---

## 1. r/SideProject

**Title:** I built a tool that converts ultra-long screenshots to text — because regular OCR tools keep cutting off my chat histories

**Body:**

Hey everyone! I built Long2Text ([long2text.com](https://long2text.com)) to solve a problem I kept running into: when I take a super long screenshot of a chat conversation or a meeting transcript, regular OCR tools either choke on the size, miss chunks of text, or mangle the formatting.

**How it works:**
- Upload any long screenshot (drag & drop or Ctrl+V paste)
- It automatically splits the image into overlapping segments
- Each segment gets OCR'd and then intelligently merged — no lost text at the seams
- Output is clean, formatted text you can copy or download as Markdown

**What makes it different from regular OCR:**
- Purpose-built for LONG images (scrolling screenshots, chat logs, etc.)
- Smart overlap algorithm prevents text from being cut at split boundaries
- Works with Chinese, English, and mixed text
- Free for short texts, $0.99 per unlock for long results

Built with Next.js, Vercel, and Tencent Cloud OCR. Would love feedback!

---

## 2. r/productivity

**Title:** Free tool to convert long chat screenshots into copy-pasteable text

**Body:**

If you ever need to extract text from a long scrolling screenshot — like a WhatsApp/WeChat conversation, a meeting transcript capture, or a long article screenshot — I built a free tool for this: [long2text.com](https://long2text.com)

Just paste or drag your screenshot, and it gives you clean formatted text in seconds. No app install needed, works in browser.

Short results are completely free. Longer texts (500+ chars) cost $0.99 to unlock the full result.

Been using it myself to archive important conversations and meeting notes. Thought others might find it useful too.

---

## 3. r/webdev (Show HN style)

**Title:** Show r/webdev: Long2Text — smart OCR for ultra-long screenshots with overlap-based merging

**Body:**

I built an OCR tool specifically for long/tall screenshots that regular OCR struggles with.

**The technical challenge:** When you have a 10,000px tall screenshot, you can't just send it to an OCR API — most have size limits, and even if they accept it, accuracy drops. The naive solution is to split it, but then you lose text at the boundaries.

**My approach:**
- Client-side splitting with Canvas API (200px overlap between segments)
- Each segment sent to Tencent Cloud GeneralBasicOCR
- Smart merge algorithm that compares tail/head lines across segments to deduplicate overlap regions
- All splitting/merging happens in the browser, only the OCR calls hit the server

**Stack:** Next.js 16 + Vercel Serverless + Tencent Cloud OCR + Stripe + Drizzle/Postgres

Repo isn't public yet but happy to discuss the approach. Try it at [long2text.com](https://long2text.com)

---

## 4. Twitter/X Thread

**Tweet 1:**
I built a tool that converts ultra-long screenshots into clean text.

Regular OCR tools choke on tall images. Long2Text splits them smartly, OCRs each piece, and merges without losing a single character.

Free to try → long2text.com

**Tweet 2:**
Why I built this:

I kept screenshotting long chat conversations and meeting transcripts. Needed the text for notes/search.

Every OCR tool either:
❌ Cut off text at boundaries
❌ Failed on large images
❌ Garbled the formatting

So I fixed it.

**Tweet 3:**
How it works under the hood:

1. Browser splits your image into overlapping segments (200px overlap)
2. Each segment → OCR API
3. Smart merge: compares tail/head lines to remove duplicates
4. Clean Markdown output

No text lost. No install needed.

---

## 5. Product Hunt (Tagline + Description)

**Tagline:** Convert ultra-long screenshots to text — no more lost characters

**Description:**

Long2Text is a free browser-based tool that converts scrolling screenshots into clean, formatted text.

**The problem:** Regular OCR tools fail on ultra-long images. They either reject the file, lose text at splitting boundaries, or produce garbled output.

**The solution:** Long2Text automatically splits your screenshot into overlapping segments, recognizes each one, and intelligently merges them — ensuring every character is captured.

**Perfect for:**
- Chat conversation screenshots (WhatsApp, WeChat, Slack, Telegram)
- Meeting transcript captures
- Long article or document screenshots
- Any scrolling screenshot you need as searchable text

**Pricing:**
- Free: unlimited conversions, full results for short texts
- $0.99: unlock full result for long texts (one-time, no subscription)

Try it now at long2text.com — just drag, drop, done.
