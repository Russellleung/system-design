import { analyseStructuredText } from "@/lib/vision-analysis";

export type TwinInputEntry = {
  id: string;
  kind: "thought" | "moment";
  text: string;
  createdAt: string;
  hasPhoto: boolean;
  photoName?: string;
};

export type TwinPortrait = {
  title: string;
  snapshot: string;
  themes: string[];
  valuesInAction: string[];
  recurringPatterns: string[];
  openQuestions: string[];
  evidenceNote: string;
};

const twinSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "snapshot", "themes", "valuesInAction", "recurringPatterns", "openQuestions", "evidenceNote"],
  properties: {
    title: { type: "string" },
    snapshot: { type: "string" },
    themes: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } },
    valuesInAction: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
    recurringPatterns: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
    openQuestions: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
    evidenceNote: { type: "string" },
  },
} as const;

export async function synthesizeTwin(entries: TwinInputEntry[]) {
  const evidence = entries.map((entry) => ({
    time: entry.createdAt,
    kind: entry.kind,
    words: entry.text,
    photoAttached: entry.hasPhoto,
    photoName: entry.photoName,
  }));
  const prompt = `Create a provisional, editable self-portrait from the user's own journal entries below. Return JSON matching the schema. Distinguish direct evidence from interpretation. Use tentative phrases such as "seems", "today suggests" and "may". Do not diagnose, identify, or infer age, gender, sexuality, ethnicity, religion, politics, health, disability, income, precise location or other sensitive traits. Do not infer personality from a photo attachment or filename; photos are not included, and only the user's caption may be evidence. Never make a fixed claim about who the user is from one day. Keep every section concise and constructive.\n\nEntries:\n${JSON.stringify(evidence)}`;
  return analyseStructuredText({ prompt, schema: twinSchema, schemaName: "digital_twin_portrait" });
}

function isText(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }

export function parseTwinPortrait(outputText: string): TwinPortrait | null {
  let value: unknown;
  try { value = JSON.parse(outputText); } catch { return null; }
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  const validList = (candidate: unknown, min: number, max: number) => Array.isArray(candidate) && candidate.length >= min && candidate.length <= max && candidate.every(isText);
  if (!isText(item.title) || !isText(item.snapshot)
    || !validList(item.themes, 2, 5)
    || !validList(item.valuesInAction, 1, 5)
    || !validList(item.recurringPatterns, 1, 5)
    || !validList(item.openQuestions, 2, 4)
    || !isText(item.evidenceNote)) return null;
  return item as TwinPortrait;
}

export function portraitToMarkdown(portrait: TwinPortrait, entries: TwinInputEntry[]) {
  const list = (items: string[]) => items.map((item) => `- ${item}`).join("\n");
  const timeline = entries.map((entry) => `- **${new Date(entry.createdAt).toLocaleString("en-AU")}** — ${entry.text || "Photo saved without a caption."}${entry.hasPhoto ? ` _(photo: ${entry.photoName ?? "attached"})_` : ""}`).join("\n");
  return `# ${portrait.title}\n\n> A provisional reflection generated from my own entries. It is editable evidence, not a diagnosis or fixed identity.\n\n## Current snapshot\n\n${portrait.snapshot}\n\n## Themes\n\n${list(portrait.themes)}\n\n## Values visible in action\n\n${list(portrait.valuesInAction)}\n\n## Recurring patterns\n\n${list(portrait.recurringPatterns)}\n\n## Questions to revisit\n\n${list(portrait.openQuestions)}\n\n## Evidence and limits\n\n${portrait.evidenceNote}\n\n## Today’s source entries\n\n${timeline}\n`;
}
