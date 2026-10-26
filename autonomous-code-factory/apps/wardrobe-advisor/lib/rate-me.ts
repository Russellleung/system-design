import { analyseStructuredImage } from "@/lib/vision-analysis";

export type RatingDimension = {
  name: "Face" | "Body & presence" | "Style" | "Photo quality" | "Dating appeal";
  score: number;
  note: string;
};

export type ReferenceSearch = {
  title: string;
  query: string;
  why: string;
};

export type DatingPhotoRating = {
  usableAsDatingPhoto: boolean;
  overallScore: number;
  verdict: string;
  bestUse: "Lead photo" | "Supporting photo" | "Retake";
  firstImpressions: string[];
  dimensions: RatingDimension[];
  attractiveFeatures: string[];
  lessAttractiveFeatures: string[];
  likelyLikes: string[];
  likelyDislikes: string[];
  strengths: string[];
  improvements: string[];
  referenceSearches: ReferenceSearch[];
  confidenceNote: string;
};

const ratingSchema = {
  type: "object",
  additionalProperties: false,
  required: ["usableAsDatingPhoto", "overallScore", "verdict", "bestUse", "firstImpressions", "dimensions", "attractiveFeatures", "lessAttractiveFeatures", "likelyLikes", "likelyDislikes", "strengths", "improvements", "referenceSearches", "confidenceNote"],
  properties: {
    usableAsDatingPhoto: { type: "boolean" },
    overallScore: { type: "number", minimum: 1, maximum: 10 },
    verdict: { type: "string" },
    bestUse: { type: "string", enum: ["Lead photo", "Supporting photo", "Retake"] },
    firstImpressions: { type: "array", minItems: 4, maxItems: 6, items: { type: "string" } },
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
    attractiveFeatures: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
    lessAttractiveFeatures: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
    likelyLikes: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
    likelyDislikes: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
    strengths: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" } },
    improvements: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" } },
    referenceSearches: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "query", "why"],
        properties: {
          title: { type: "string" },
          query: { type: "string" },
          why: { type: "string" },
        },
      },
    },
    confidenceNote: { type: "string" },
  },
} as const;

const ratingPrompt = `Act like the user's extroverted, brutally honest friend reviewing an adult dating-profile photo. The user confirms that every person shown is at least 18 and consented to appearance feedback. Return JSON matching the schema. Score exactly five dimensions in this exact order: Face, Body & presence, Style, Photo quality, Dating appeal.

Be unsparing, specific, colloquial and useful. Lead the verdict with the most important truth. Do not use a compliment sandwich, corporate coaching language, fake positivity or inflated scores. A 5 is ordinary, 7 is genuinely strong, 9 is exceptional, and 10 should almost never be used. Be equally truthful about what works: identify two or three genuine visible strengths and explain why each helps. Do not invent praise, but do not hide or downgrade a real strength merely to sound harsh. Comment directly on visible facial appeal in this image, including expression, grooming, hair, smile, eye contact, skin presentation, angle and how the features are presented. Comment directly on visible body presentation, posture, silhouette, outfit fit and physical presence. This is a subjective rating of how the adult appears in one photograph, not a statement of human worth.

Write firstImpressions as four to six short, natural reactions from an observant friend. Each reaction must name a concrete visible detail and its effect. Mix genuine enthusiasm and criticism when the image supports both. Good specificity sounds like: "Okay, that smile is warm—you look instantly approachable," "That shirt colour really works with the rest of the shot," or "The harsh light is exaggerating every bit of skin texture." Do not reuse those examples unless they are genuinely visible. Avoid vague filler such as "nice photo," "you look good," "improve grooming," or "great style." If hair, smile, eyes, facial hair, accessories, a particular garment, posture, skin texture, shine, flaking or a visible blemish stands out, say so plainly. Describe only visible appearance; do not diagnose a skin condition. Suggest only low-risk, reversible photo preparation, and never advise squeezing, picking or popping a blemish.

In attractiveFeatures and lessAttractiveFeatures, directly name the visible facial, body-presentation, grooming and styling features that increase or reduce this photo's appeal. Explain the effect of each feature instead of merely labelling it attractive or unattractive. Do not turn temporary photo problems such as bad light into claims about the person's permanent appearance.

In likelyLikes and likelyDislikes, describe what some adult women browsing a dating profile may respond positively or negatively to in this specific image. Be candid, but never claim that women are a monolith or that any reaction is guaranteed. Focus on observable presentation signals such as warmth, confidence, authenticity, grooming, style, posture, effort and photo context. Do not infer sexual preferences or use stereotypes.

Create exactly three referenceSearches: one for face/hair/grooming presentation, one for body silhouette/outfit/pose, and one for a photo setting or composition to emulate. Each query must be a concise generic image-search query based only on clearly visible, non-identifying descriptors. It may use neutral face-shape, hairstyle, silhouette, clothing, pose, lighting and setting terms, but must not contain a person's name, a guessed identity, ethnicity, disability, health condition, exact age, exact weight, insulting body label or sexualised phrase. The searches are inspiration, not lookalike identification. Explain exactly what the user should copy from each result set.

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
    || !Array.isArray(item.firstImpressions) || item.firstImpressions.length < 4 || item.firstImpressions.length > 6 || !item.firstImpressions.every(isText)
    || !Array.isArray(item.dimensions) || item.dimensions.length !== 5
    || !item.dimensions.every((dimension, index) => {
      if (typeof dimension !== "object" || dimension === null) return false;
      const row = dimension as Record<string, unknown>;
      return row.name === names[index]
        && typeof row.score === "number" && row.score >= 0 && row.score <= 10
        && isText(row.note);
    })
    || !Array.isArray(item.attractiveFeatures) || item.attractiveFeatures.length < 2 || item.attractiveFeatures.length > 4 || !item.attractiveFeatures.every(isText)
    || !Array.isArray(item.lessAttractiveFeatures) || item.lessAttractiveFeatures.length < 2 || item.lessAttractiveFeatures.length > 4 || !item.lessAttractiveFeatures.every(isText)
    || !Array.isArray(item.likelyLikes) || item.likelyLikes.length < 2 || item.likelyLikes.length > 4 || !item.likelyLikes.every(isText)
    || !Array.isArray(item.likelyDislikes) || item.likelyDislikes.length < 2 || item.likelyDislikes.length > 4 || !item.likelyDislikes.every(isText)
    || !Array.isArray(item.strengths) || item.strengths.length < 2 || item.strengths.length > 3 || !item.strengths.every(isText)
    || !Array.isArray(item.improvements) || item.improvements.length < 2 || item.improvements.length > 3 || !item.improvements.every(isText)
    || !Array.isArray(item.referenceSearches) || item.referenceSearches.length !== 3 || !item.referenceSearches.every((search) => {
      if (typeof search !== "object" || search === null) return false;
      const row = search as Record<string, unknown>;
      return isText(row.title) && isText(row.query) && isText(row.why);
    })
    || !isText(item.confidenceNote)) return null;
  return item as DatingPhotoRating;
}
