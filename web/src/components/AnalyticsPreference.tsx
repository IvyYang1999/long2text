"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

const KEY = "l2t-analytics-choice-v1";
function preference() {
  try {
    const old = JSON.parse(localStorage.getItem("dc-analytics-consent-v1") || "null");
    const privacyNavigator = navigator as Navigator & { globalPrivacyControl?: boolean };
    const privacyWindow = window as Window & { doNotTrack?: string };
    const blocked = navigator.doNotTrack === "1" || privacyWindow.doNotTrack === "1" || privacyNavigator.globalPrivacyControl === true
      || old === "denied" || old?.value === "denied" || old?.status === "denied";
    return { ready: true, blocked, active: !blocked && localStorage.getItem(KEY) === "granted" };
  } catch { return { ready: true, blocked: true, active: false }; }
}

/** Explicit, inline opt-in on the privacy page only — never a banner or modal. */
export default function AnalyticsPreference({ locale }: { locale: Locale }) {
  const zh = locale === "zh";
  const [state, setState] = useState({ ready: false, blocked: false, active: false });
  const [error, setError] = useState(false);
  useEffect(() => {
    const sync = () => setState(preference());
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function choose() {
    const current = preference();
    if (current.blocked) { setState(current); return; }
    try {
      localStorage.setItem(KEY, current.active ? "denied" : "granted");
      window.dispatchEvent(new Event("l2t:privacy"));
      window.location.reload();
    } catch { setError(true); }
  }
  return (
    <section id="analytics" className="scroll-mt-24 rounded-2xl border border-line bg-wash p-5">
      <h2 className="text-lg font-semibold text-ink">{zh ? "可选统计设置" : "Optional analytics preference"}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{zh ? "默认关闭。主动开启后，Google Analytics 会用 Cookie 统计访问、转换、导出及付款确认事件；不会收到截图正文、文件名或付款标识。不开启也能使用全部功能。" : "Off by default. If you enable it, Google Analytics uses cookies to measure visits, conversions, exports and payment confirmations. It does not receive screenshot content, file names or payment identifiers. All features work with analytics off."}</p>
      <p className="mt-3 text-sm font-medium text-ink">{zh ? `当前状态：${state.active ? "开启" : "关闭"}` : `Current status: ${state.active ? "On" : "Off"}`}</p>
      {state.blocked && <p className="mt-2 text-sm text-muted">{zh ? "浏览器隐私信号、已有拒绝记录或不可用的本地存储使统计保持关闭；此处不会覆盖这些限制。" : "A browser privacy signal, an existing refusal or unavailable local storage keeps analytics off. This control does not override those restrictions."}</p>}
      <button onClick={choose} disabled={!state.ready || state.blocked} className="mt-4 min-h-11 rounded-full border border-line bg-white px-5 py-2 text-sm font-medium text-ink hover:border-accent disabled:cursor-not-allowed disabled:opacity-50">
        {zh ? (state.active ? "关闭可选统计" : "开启可选统计") : (state.active ? "Disable optional analytics" : "Enable optional analytics")}
      </button>
      <p className="mt-2 text-xs text-muted">{zh ? "选择仅保存在此浏览器；更改后会刷新本页。" : "Saved in this browser only. Changing this preference reloads this page."}</p>
      <p role="status" className="mt-2 text-sm text-red-700">{error ? (zh ? "无法保存设置，统计未开启。" : "Could not save your preference. Analytics was not enabled.") : ""}</p>
    </section>
  );
}
