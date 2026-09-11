import RootShell from "@/components/RootShell";

export default function EnglishRoot({ children }: { children: React.ReactNode }) {
  return <RootShell lang="en">{children}</RootShell>;
}
