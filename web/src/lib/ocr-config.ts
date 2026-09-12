export type OcrProvider = "google" | "tencent";
// Leave room for multipart framing under Vercel's 4.5 MB limit.
export const OCR_MAX_BYTES = 4_000_000;
export const GOOGLE_MAX_PIXELS = 75_000_000;

export function configuredOcrProvider(env: Record<string, string | undefined> = process.env): OcrProvider {
  const provider = env.OCR_PROVIDER?.trim() || (env.GOOGLE_VISION_API_KEY?.trim() ? "google" : "tencent");
  if (provider !== "google" && provider !== "tencent") throw new Error("Invalid OCR provider configuration");
  return provider;
}
