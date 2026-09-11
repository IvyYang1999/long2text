import { NextRequest, NextResponse } from "next/server";
import {
  CORRECT_MODEL_DEFAULT,
  CORRECT_PARAMS,
  CORRECT_PROMPT,
  LIMITS,
  decodeOutput,
  guardCorrection,
  modelParams,
} from "@/lib/correct-contract";

export const maxDuration = 20;

const ENDPOINT = "https://api.siliconflow.cn/v1/chat/completions";

/** Lets the page hide the AI toggle when no model key is configured. */
export async function GET() {
  return NextResponse.json({ enabled: !!process.env.SILICONFLOW_API_KEY?.trim() });
}

/**
 * AI correction of ONE low-confidence OCR line.
 * Body: { context: string, text: string, confidence: number }
 * Response: { text, changed, reason? } — on any failure `text` is the original
 * and `changed` is false, so the client can apply the response blindly.
 * 503 when no model key is configured (the client then hides the feature).
 */
export async function POST(request: NextRequest) {
  const key = process.env.SILICONFLOW_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "AI correction not configured" }, { status: 503 });

  let body: { context?: unknown; text?: unknown; confidence?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text : "";
  const context = typeof body.context === "string" ? body.context : "";
  const confidence = typeof body.confidence === "number" && Number.isFinite(body.confidence) ? Math.round(body.confidence) : NaN;
  if (!text.trim() || text.length > LIMITS.text || context.length > LIMITS.context || Number.isNaN(confidence)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const keep = (reason: string) => NextResponse.json({ text, changed: false, reason });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  const started = Date.now();
  const model = process.env.SILICONFLOW_MODEL?.trim() || CORRECT_MODEL_DEFAULT;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        ...CORRECT_PARAMS,
        ...modelParams(model),
        model,
        messages: [
          { role: "system", content: CORRECT_PROMPT },
          { role: "user", content: JSON.stringify({ context, text, confidence }) },
        ],
      }),
    });
    if (res.status === 429) return NextResponse.json({ error: "rate limited" }, { status: 429 });
    if (!res.ok) {
      console.error(`[correct] upstream ${res.status}`);
      return keep(`upstream-${res.status}`);
    }
    const data = await res.json();
    const choice = data?.choices?.[0];
    if (choice?.finish_reason && choice.finish_reason !== "stop") return keep(`finish-${choice.finish_reason}`);
    let corrected: string;
    try {
      corrected = decodeOutput(choice?.message?.content ?? "");
    } catch {
      return keep("invalid-output");
    }
    if (corrected === text) return NextResponse.json({ text, changed: false, ms: Date.now() - started });
    const rejected = guardCorrection(text, corrected);
    if (rejected) return keep(rejected);
    return NextResponse.json({ text: corrected, changed: true, ms: Date.now() - started });
  } catch (err) {
    const reason = err instanceof Error && err.name === "AbortError" ? "timeout" : "network";
    console.error(`[correct] ${reason}`);
    return keep(reason);
  } finally {
    clearTimeout(timer);
  }
}
