import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };

/** Social card (latin text only — the OG renderer has no CJK font). */
export function ogImage() {
  const lines = [
    ["Anna", "Can we move the design review to Friday?"],
    ["Me", "Sure — I'll update the deck tonight."],
    ["Anna", "Great. Please bring the Q3 numbers too."],
  ];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#ffffff", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "#3355ff", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <div style={{ width: 15, height: 38, borderRadius: 4, background: "#fff" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ width: 13, height: 4, borderRadius: 2, background: "#fff" }} />
                <div style={{ width: 13, height: 4, borderRadius: 2, background: "#fff" }} />
                <div style={{ width: 8, height: 4, borderRadius: 2, background: "#fff" }} />
              </div>
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, color: "#0d1321" }}>Long2Text</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 68, fontWeight: 800, color: "#0d1321", letterSpacing: -2, lineHeight: 1.05 }}>Long screenshots</div>
            <div style={{ fontSize: 68, fontWeight: 800, color: "#3355ff", letterSpacing: -2, lineHeight: 1.05 }}>to clean text.</div>
            <div style={{ fontSize: 28, color: "#5a6376", marginTop: 24 }}>Chats · meeting notes · articles — free, in seconds</div>
          </div>
        </div>
        <div style={{ width: 360, display: "flex", flexDirection: "column", gap: 18, background: "#f6f7f9", borderRadius: 28, padding: 32, justifyContent: "center" }}>
          {lines.map(([who, text], i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", background: "#fff", borderRadius: 16, padding: "14px 18px", border: "1px solid #e7e9ee" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#0d1321" }}>{who}</div>
              <div style={{ fontSize: 20, color: "#2b3242", marginTop: 4 }}>{text}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    ogSize,
  );
}
