import { analyseStructuredImage } from "@/lib/vision-analysis";

export const visualMatchAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "summary", "presentationMatch", "styleAndColour", "bodyLanguage", "photoCoherence", "limitation"],
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    presentationMatch: { type: "string" },
    styleAndColour: { type: "string" },
    bodyLanguage: { type: "string" },
    photoCoherence: { type: "string" },
    limitation: { type: "string" },
  },
} as const;

const prompt = `Analyse this AI-generated image of a fictional adult couple. Explain why the two people do or do not work as a visually believable, aesthetically balanced pairing in this photograph.

Be candid and specific about visible evidence only. Evaluate whether they appear to be in a comparable broad tier of physical attractiveness and presentation; apparent adult-age alignment; grooming and wardrobe polish; complementary styling and colour; proportions and placement in the frame; body language; lighting, perspective and photographic realism. Explicitly mention if one person looks substantially more glamorous, model-like, polished or conventionally attractive than the other.

Do not identify either person, infer protected traits, rank human worth, claim psychological or romantic compatibility, or say they would succeed as a real couple. Do not assume ethnicity should match. Treat this only as critique of one synthetic composition. Use concise plain language and return JSON matching the supplied schema. The limitation must remind the user that visual harmony in one generated image cannot predict real attraction or compatibility.`;

export type VisualMatchAnalysis = {
  headline: string;
  summary: string;
  presentationMatch: string;
  styleAndColour: string;
  bodyLanguage: string;
  photoCoherence: string;
  limitation: string;
};

export function analyseVisualMatch(imageBase64: string, mimeType: string) {
  return analyseStructuredImage({
    imageBase64,
    mimeType,
    prompt,
    schema: visualMatchAnalysisSchema,
    schemaName: "visual_match_analysis",
  });
}

export function parseVisualMatchAnalysis(outputText: string): VisualMatchAnalysis | null {
  let value: unknown;
  try {
    value = JSON.parse(outputText);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const result = value as Record<string, unknown>;
  const keys: (keyof VisualMatchAnalysis)[] = ["headline", "summary", "presentationMatch", "styleAndColour", "bodyLanguage", "photoCoherence", "limitation"];
  if (!keys.every((key) => typeof result[key] === "string" && result[key].trim().length > 0)) return null;
  return result as VisualMatchAnalysis;
}
