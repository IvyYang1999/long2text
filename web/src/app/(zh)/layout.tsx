import RootShell from "@/components/RootShell";

export default function ChineseRoot({ children }: { children: React.ReactNode }) {
  return <RootShell lang="zh-CN">{children}</RootShell>;
}
