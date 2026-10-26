import { analyseStructuredImage } from "@/lib/vision-analysis";

export type RatingDimension = {
  name: "Face" | "Body & presence" | "Style" | "Photo quality" | "Dating appeal";
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
          name: { type: "string", enum: ["Face", "Body & presence", "Style", "Photo quality", "Dating appeal"] },
          score: { type: "number", minimum: 0, maximum: 10 },
          note: { type: "string" },
        },
      },
    },
    strengths: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" } },
    improvements: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" } },
    confidenceNote: { type: "string" },
  },
} as const;

const ratingPrompt = `Act like the user's extroverted, brutally honest friend reviewing an adult dating-profile photo. The user confirms that every person shown is at least 18 and consented to appearance feedback. Return JSON matching the schema. Score exactly five dimensions in this exact order: Face, Body & presence, Style, Photo quality, Dating appeal.

Be unsparing, specific, colloquial and useful. Lead the verdict with the most important truth. Do not use a compliment sandwich, corporate coaching language, fake positivity or inflated scores. A 5 is ordinary, 7 is genuinely strong, 9 is exceptional, and 10 should almost never be used. Be equally truthful about what works: identify two or three genuine visible strengths and explain why each helps. Do not invent praise, but do not hide or downgrade a real strength merely to sound harsh. Comment directly on visible facial appeal in this image, including expression, grooming, angle and how the features are presented. Comment directly on visible body presentation, posture, silhouette, outfit fit and physical presence. This is a subjective rating of how the adult appears in one photograph, not a statement of human worth.

Use a score of 0 for Face or Body & presence when that area is not visible enough to judge, and say so plainly. Judge only what is visibly presented. Do not identify anyone or infer age, gender, sexual orientation, ethnicity, health, disability, exact weight, income, personality or emotion. Do not sexualise, fetishise, use slurs, compare the subject to an animal or object, or recommend dangerous dieting, cosmetic procedures or changing protected physical traits. Harsh means accurate and actionable, not automatically negative or humiliating. Do not claim to predict what all women or any demographic will like, and do not promise matches. If no person is clearly visible, set usableAsDatingPhoto to false, bestUse to Retake, overallScore to 1, and use 0 for Face and Body & presence. Give two or three concise genuine strengths and two or three blunt improvements the user can actually make through grooming, styling, posture, expression, camera choice, light or framing.`;

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
  const names = ["Face", "Body & presence", "Style", "Photo quality", "Dating appeal"];
  if (typeof item.usableAsDatingPhoto !== "boolean"
    || typeof item.overallScore !== "number" || item.overallScore < 1 || item.overallScore > 10
    || !isText(item.verdict)
    || !["Lead photo", "Supporting photo", "Retake"].includes(item.bestUse as string)
    || !Array.isArray(item.dimensions) || item.dimensions.length !== 5
    || !item.dimensions.every((dimension, index) => {
      if (typeof dimension !== "object" || dimension === null) return false;
      const row = dimension as Record<string, unknown>;
      return row.name === names[index]
        && typeof row.score === "number" && row.score >= 0 && row.score <= 10
        && isText(row.note);
    })
    || !Array.isArray(item.strengths) || item.strengths.length < 2 || item.strengths.length > 3 || !item.strengths.every(isText)
    || !Array.isArray(item.improvements) || item.improvements.length < 2 || item.improvements.length > 3 || !item.improvements.every(isText)
    || !isText(item.confidenceNote)) return null;
  return item as DatingPhotoRating;
}
