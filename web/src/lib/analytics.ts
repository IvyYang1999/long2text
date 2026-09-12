type FunnelEvent = "upload_started" | "ocr_completed" | "ocr_partial" | "ocr_failed" | "export_completed" | "download_started" | "begin_checkout" | "payment_verified" | "pricing_view" | "paywall_view" | "login_started" | "login_success" | "login_failed" | "checkout_clicked" | "checkout_failed";
type ExportMethod = "copy" | "markdown" | "html" | "markdown_zip";
export type InputMethod = "file" | "paste" | "drop" | "sample";
export type ResultAccess = "preview" | "free" | "paid";
type EntryPoint = "header" | "paywall";
export type GrowthFields = {
  method?: ExportMethod;
  input_method?: InputMethod;
  result_access?: ResultAccess;
  duration_bucket?: "under_3s" | "3_10s" | "10_30s" | "30s_plus";
  failure_stage?: "prepare" | "recognize" | "assemble" | "checkout" | "login";
  entry_point?: EntryPoint;
};
declare global {
  interface Window {
    __l2tGrowthReady?: boolean;
    __l2tGrowthPending?: Array<GrowthFields & { name: FunnelEvent }>;
  }
}

// This guards only local startup buffering/login markers. Transmission is always
// revalidated by the site loader, including its public-path allowlist.
export function analyticsConsent() {
  if (typeof window === "undefined") return false;
  try {
    const old = JSON.parse(localStorage.getItem("dc-analytics-consent-v1") || "null");
    return localStorage.getItem("l2t-analytics-choice-v1") === "granted"
      && old !== "denied" && old?.value !== "denied" && old?.status !== "denied"
      && navigator.doNotTrack !== "1" && (window as Window & { doNotTrack?: string }).doNotTrack !== "1"
      && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl !== true;
  } catch { return false; }
}

export function durationBucket(ms: number): GrowthFields["duration_bucket"] {
  return ms < 3000 ? "under_3s" : ms < 10000 ? "3_10s" : ms < 30000 ? "10_30s" : "30s_plus";
}

/** No arbitrary metadata accepted. The consent-aware loader owns transmission. */
export function trackFunnel(name: FunnelEvent, options?: ExportMethod | GrowthFields) {
  if (typeof window === "undefined") return;
  if (name === "login_failed") {
    try { sessionStorage.removeItem("l2t-login-v1"); } catch { /* never block the action */ }
  }
  const detail = { name, ...(typeof options === "string" ? { method: options } : options) };
  if (!window.__l2tGrowthReady && analyticsConsent()) {
    const pending = window.__l2tGrowthPending ||= [];
    if (pending.length < 20) pending.push(detail);
  }
  window.dispatchEvent(new CustomEvent("l2t:analytics", { detail }));
}

export function trackLoginStart(entry_point: EntryPoint) {
  trackFunnel("login_started", { entry_point });
  if (!analyticsConsent()) return;
  try { sessionStorage.setItem("l2t-login-v1", JSON.stringify({ entry: entry_point, at: Date.now() })); } catch { /* login still works */ }
}

export function trackLoginSuccess() {
  if (!analyticsConsent()) return;
  try {
    const pending = JSON.parse(sessionStorage.getItem("l2t-login-v1") || "null");
    sessionStorage.removeItem("l2t-login-v1");
    if (pending && ["header", "paywall"].includes(pending.entry) && Number.isFinite(pending.at)
      && pending.at <= Date.now() && Date.now() - pending.at < 15 * 60 * 1000) {
      trackFunnel("login_success", { entry_point: pending.entry });
    }
  } catch { /* no marker, not a measured new login */ }
}
