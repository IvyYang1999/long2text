/** Small stroke icon set (24×24, currentColor). */
type P = { className?: string };
const base = (className = "h-5 w-5") => ({
  className,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconUpload = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 15V4" /><path d="m7 8.5 5-5 5 5" /><path d="M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14" /></svg>
);
export const IconLock = ({ className }: P) => (
  <svg {...base(className)}><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>
);
export const IconSlices = ({ className }: P) => (
  <svg {...base(className)}><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M4 8.5h16M4 15.5h16" strokeDasharray="2 2.2" /></svg>
);
export const IconBolt = ({ className }: P) => (
  <svg {...base(className)}><path d="M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8Z" /></svg>
);
export const IconDoc = ({ className }: P) => (
  <svg {...base(className)}><path d="M6.5 3h7.5L18 7v12.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3Z" /><path d="M14 3v4h4M8.5 12h7M8.5 15.5h7M8.5 8.5h3" /></svg>
);
export const IconChat = ({ className }: P) => (
  <svg {...base(className)}><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5v6a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3h0A1.5 1.5 0 0 1 4 11.5Z" /><path d="M16 8.5h2.5A1.5 1.5 0 0 1 20 10v6a1.5 1.5 0 0 1-1.5 1.5v3l-3.5-3h-4a1.5 1.5 0 0 1-1.5-1.5V15" /></svg>
);
export const IconMeeting = ({ className }: P) => (
  <svg {...base(className)}><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8M12 17v4M7 9.5h6M7 12.5h9" /></svg>
);
export const IconArticle = ({ className }: P) => (
  <svg {...base(className)}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7.5h8M8 11h8M8 14.5h5" /></svg>
);
export const IconCheck = ({ className }: P) => (
  <svg {...base(className)}><path d="m5 12.5 4.5 4.5L19 7" /></svg>
);
export const IconCopy = ({ className }: P) => (
  <svg {...base(className)}><rect x="8.5" y="8.5" width="12" height="12" rx="2" /><path d="M15.5 8.5V5A1.5 1.5 0 0 0 14 3.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5" /></svg>
);
export const IconDownload = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 4v11" /><path d="m7 10.5 5 5 5-5" /><path d="M5 19.5h14" /></svg>
);
export const IconSparkle = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9-5.7-1.8L10.2 9 12 3.5Z" /></svg>
);
export const IconImage = ({ className }: P) => (
  <svg {...base(className)}><rect x="3.5" y="4" width="17" height="16" rx="2" /><circle cx="9" cy="9.5" r="1.8" /><path d="m20.5 16-5-5-8.5 9" /></svg>
);
export const IconPlus = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconUndo = ({ className }: P) => (
  <svg {...base(className)}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
);
