type FunnelEvent = "upload_started" | "ocr_completed" | "ocr_partial" | "ocr_failed" | "export_completed" | "begin_checkout" | "payment_verified";
type ExportMethod = "copy" | "markdown" | "html" | "markdown_zip";

/** No arbitrary metadata accepted. The consent-aware loader owns transmission. */
export function trackFunnel(name: FunnelEvent, method?: ExportMethod) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("l2t:analytics", { detail: { name, method } }));
}
