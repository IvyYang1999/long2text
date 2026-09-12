import cases from "@/lib/cases.json";
import { applyMode, withImageFiles } from "@/lib/export";

export const guideSampleIds = ["en-chat", "en-article"] as const;
export type GuideSampleId = typeof guideSampleIds[number];

/** Only already-public demo material may be exported from the sample routes. */
export function guideSample(id: string) {
  if (!guideSampleIds.some(value => value === id)) return null;
  const sampleId = id as GuideSampleId;
  const record = cases[sampleId];
  const markdown = applyMode(record.markdown, record.figures, "rich", "image");
  return {
    id: sampleId, ...record, markdown,
    portableMarkdown: withImageFiles(markdown),
    textMarkdown: applyMode(record.markdown, record.figures, "text", "image"),
    figureUrls: Object.fromEntries(record.figures.map(f => [f.id, `/samples/figs/${sampleId}-${f.id}.jpg`])),
  };
}
