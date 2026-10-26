import { analyseStructuredImage } from "@/lib/vision-analysis";

export type RatingDimension = {
  name: "Clarity" | "Composition" | "Approachability" | "Authenticity" | "Conversation potential";
  score: number;
  note: string;
};

export type DatingPhotoRating = {
  usableAsDatingPhoto: boolean;
  overallScore: number;
  verdict: string;
  bestUse: "Lead photo" | "Supporting photo" | "Retake";
  dimensions: RatingDimension[];
  strengths: string[];
  improvements: string[];
  confidenceNote: string;
};

const ratingSchema = {
  type: "object",
  additionalProperties: false,
  required: ["usableAsDatingPhoto", "overallScore", "verdict", "bestUse", "dimensions", "strengths", "improvements", "confidenceNote"],
  properties: {
    usableAsDatingPhoto: { type: "boolean" },
    overallScore: { type: "number", minimum: 1, maximum: 10 },
    verdict: { type: "string" },
    bestUse: { type: "string", enum: ["Lead photo", "Supporting photo", "Retake"] },
    dimensions: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "score", "note"],
        properties: {
          name: { type: "string", enum: ["Clarity", "Composition", "Approachability", "Authenticity", "Conversation potential"] },
          score: { type: "number", minimum: 1, maximum: 10 },
          note: { type: "string" },
        },
      },
    },
    strengths: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" } },
    improvements: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" } },
    confidenceNote: { type: "string" },
  },
} as const;

const ratingPrompt = `Evaluate this image only as a potential dating-profile photograph. The user confirms that every person shown is at least 18. Return JSON matching the schema. Score exactly five dimensions in this exact order: Clarity, Composition, Approachability, Authenticity, Conversation potential. Scores measure the photograph's effectiveness, never the person's physical attractiveness or worth. Base advice on observable photographic factors: whether the subject is easy to identify, face visibility, lighting, focus, framing, distracting background, natural presentation, and whether the setting provides a useful conversation hook. Do not identify anyone or infer age, gender, sexual orientation, ethnicity, health, disability, body shape, weight, income, personality or emotion. Do not sexualise the subject. Do not claim to predict what women or any demographic will like, and do not promise matches. If no person is clearly visible, set usableAsDatingPhoto to false, bestUse to Retake, and keep all scores at 1. Use concise, respectful language and give changes the photographer can make.`;

export async function analyseDatingPhoto(imageBase64: string, mimeType: string) {
  return analyseStructuredImage({
    imageBase64,
    mimeType,
    prompt: ratingPrompt,
    schema: ratingSchema,
    schemaName: "dating_photo_rating",
  });
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseDatingPhotoRating(outputText: string): DatingPhotoRating | null {
  let value: unknown;
  try { value = JSON.parse(outputText); } catch { return null; }
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  const names = ["Clarity", "Composition", "Approachability", "Authenticity", "Conversation potential"];
  if (typeof item.usableAsDatingPhoto !== "boolean"
    || typeof item.overallScore !== "number" || item.overallScore < 1 || item.overallScore > 10
    || !isText(item.verdict)
    || !["Lead photo", "Supporting photo", "Retake"].includes(item.bestUse as string)
    || !Array.isArray(item.dimensions) || item.dimensions.length !== 5
    || !item.dimensions.every((dimension, index) => {
      if (typeof dimension !== "object" || dimension === null) return false;
      const row = dimension as Record<string, unknown>;
      return row.name === names[index]
        && typeof row.score === "number" && row.score >= 1 && row.score <= 10
        && isText(row.note);
    })
    || !Array.isArray(item.strengths) || item.strengths.length < 2 || item.strengths.length > 3 || !item.strengths.every(isText)
    || !Array.isArray(item.improvements) || item.improvements.length < 2 || item.improvements.length > 3 || !item.improvements.every(isText)
    || !isText(item.confidenceNote)) return null;
  return item as DatingPhotoRating;
}
