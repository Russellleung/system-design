import { analyseStructuredImage } from "@/lib/vision-analysis";

export const poseTemplates = [
  "three-quarter",
  "weight-shift",
  "walking",
  "seated-angle",
  "over-shoulder",
  "relaxed",
  "none",
] as const;

export type PoseTemplate = typeof poseTemplates[number];
export type PhotoTipCategory = "Angle" | "Pose" | "Framing" | "Lighting";

export type PhotoCoachAnalysis = {
  personVisible: boolean;
  photoSummary: string;
  primarySuggestion: {
    title: string;
    instruction: string;
    reason: string;
  };
  tips: Array<{
    category: PhotoTipCategory;
    title: string;
    instruction: string;
    reason: string;
  }>;
  poseTemplate: PoseTemplate;
  mirrorGuide: boolean;
  confidenceNote: string;
};

const photoCoachSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "personVisible",
    "photoSummary",
    "primarySuggestion",
    "tips",
    "poseTemplate",
    "mirrorGuide",
    "confidenceNote",
  ],
  properties: {
    personVisible: { type: "boolean" },
    photoSummary: { type: "string" },
    primarySuggestion: {
      type: "object",
      additionalProperties: false,
      required: ["title", "instruction", "reason"],
      properties: {
        title: { type: "string" },
        instruction: { type: "string" },
        reason: { type: "string" },
      },
    },
    tips: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "title", "instruction", "reason"],
        properties: {
          category: { type: "string", enum: ["Angle", "Pose", "Framing", "Lighting"] },
          title: { type: "string" },
          instruction: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
    poseTemplate: { type: "string", enum: poseTemplates },
    mirrorGuide: { type: "boolean" },
    confidenceNote: { type: "string" },
  },
} as const;

const photoCoachPrompt = `Act as a respectful photography coach. Analyse this photograph only for camera angle, pose mechanics, framing, background and lighting. Return JSON matching the supplied schema with exactly three practical tips. Select one dotted pose-guide template that would give the user a visibly different option for a retake. If no person is visible, set personVisible to false and poseTemplate to none. Do not identify the person or infer attractiveness, gender, age, ethnicity, health, body shape, weight, disability, income, emotion, personality or any other sensitive or subjective personal trait. Never recommend hiding, slimming or changing the person's body. Phrase every recommendation as an optional photographic technique, not a criticism of the person.`;

export async function analysePortraitPhoto(imageBase64: string, mimeType: string) {
  return analyseStructuredImage({
    imageBase64,
    mimeType,
    prompt: photoCoachPrompt,
    schema: photoCoachSchema,
    schemaName: "photo_coach_analysis",
  });
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isAdvice(value: unknown, withCategory: boolean) {
  if (typeof value !== "object" || value === null) return false;
  const advice = value as Record<string, unknown>;
  const validCategory = !withCategory
    || advice.category === "Angle"
    || advice.category === "Pose"
    || advice.category === "Framing"
    || advice.category === "Lighting";
  return validCategory
    && isString(advice.title)
    && isString(advice.instruction)
    && isString(advice.reason);
}

export function parsePhotoCoachAnalysis(outputText: string): PhotoCoachAnalysis | null {
  let value: unknown;
  try {
    value = JSON.parse(outputText);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;

  const analysis = value as Record<string, unknown>;
  if (typeof analysis.personVisible !== "boolean"
    || !isString(analysis.photoSummary)
    || !isAdvice(analysis.primarySuggestion, false)
    || !Array.isArray(analysis.tips)
    || analysis.tips.length !== 3
    || !analysis.tips.every((tip) => isAdvice(tip, true))
    || !poseTemplates.includes(analysis.poseTemplate as PoseTemplate)
    || typeof analysis.mirrorGuide !== "boolean"
    || !isString(analysis.confidenceNote)) return null;

  if (!analysis.personVisible && analysis.poseTemplate !== "none") return null;
  return analysis as PhotoCoachAnalysis;
}
