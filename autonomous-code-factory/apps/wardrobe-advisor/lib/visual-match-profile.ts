import { analyseStructuredImage } from "@/lib/vision-analysis";

const groomingLevels = ["low-key", "everyday", "polished", "high-glamour"] as const;
const styleEffortLevels = ["low-key", "everyday", "polished", "editorial"] as const;
const photoPolishLevels = ["ordinary-snapshot", "social-photo", "professionally-polished", "editorial"] as const;
const expressionLevels = ["neutral", "reserved", "soft-smile", "broad-smile", "playful", "serious"] as const;
const agePresentations = ["young-adult", "adult", "mature-adult"] as const;
const confidenceLevels = ["low", "medium", "high"] as const;

export const visualMatchProfileSchema = {
  type: "object",
  additionalProperties: false,
  required: ["physicalAttractivenessScore", "grooming", "styleEffort", "photoPolish", "expression", "agePresentation", "confidence"],
  properties: {
    physicalAttractivenessScore: { type: "integer", minimum: 1, maximum: 9 },
    grooming: { type: "string", enum: groomingLevels },
    styleEffort: { type: "string", enum: styleEffortLevels },
    photoPolish: { type: "string", enum: photoPolishLevels },
    expression: { type: "string", enum: expressionLevels },
    agePresentation: { type: "string", enum: agePresentations },
    confidence: { type: "string", enum: confidenceLevels },
  },
} as const;

export type VisualMatchProfile = {
  physicalAttractivenessScore: number;
  grooming: (typeof groomingLevels)[number];
  styleEffort: (typeof styleEffortLevels)[number];
  photoPolish: (typeof photoPolishLevels)[number];
  expression: (typeof expressionLevels)[number];
  agePresentation: (typeof agePresentations)[number];
  confidence: (typeof confidenceLevels)[number];
};

const prompt = `Calibrate the visible adult source person's presentation for an AI image-editing workflow. Return only JSON matching the schema.

Judge this one photograph, not the person's worth or real-world desirability. Score visible physical attractiveness separately from styling and photo quality. Use this strict scale: 5 is an ordinary average-looking adult, 6 is somewhat attractive, 7 is clearly attractive, 8 is unusually attractive, and 9 is rare professional-model-level presentation. Scores below 5 are allowed. Do not inflate the score to be kind. Consider only visible facial and body presentation; do not reward lighting, makeup, clothing, camera quality or setting in the physicalAttractivenessScore.

Classify grooming, styling effort, photographic polish, expression and broad adult-age presentation using the supplied enums. Do not identify the person or infer ethnicity, nationality, health, sexuality, personality, income, occupation or exact age. If visibility is limited, lower confidence rather than inventing detail.`;

export function analyseVisualMatchProfile(imageBase64: string, mimeType: string) {
  return analyseStructuredImage({
    imageBase64,
    mimeType,
    prompt,
    schema: visualMatchProfileSchema,
    schemaName: "visual_match_source_profile",
  });
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

export function parseVisualMatchProfile(outputText: string): VisualMatchProfile | null {
  let value: unknown;
  try {
    value = JSON.parse(outputText);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const profile = value as Record<string, unknown>;
  if (!Number.isInteger(profile.physicalAttractivenessScore)
    || (profile.physicalAttractivenessScore as number) < 1
    || (profile.physicalAttractivenessScore as number) > 9
    || !isOneOf(profile.grooming, groomingLevels)
    || !isOneOf(profile.styleEffort, styleEffortLevels)
    || !isOneOf(profile.photoPolish, photoPolishLevels)
    || !isOneOf(profile.expression, expressionLevels)
    || !isOneOf(profile.agePresentation, agePresentations)
    || !isOneOf(profile.confidence, confidenceLevels)) return null;
  return profile as VisualMatchProfile;
}

export function visualMatchProfilePrompt(profile: VisualMatchProfile, partnerGender: "man" | "woman") {
  const compensatedTarget = Math.max(1, profile.physicalAttractivenessScore - 1);
  return `INDEPENDENT SOURCE CALIBRATION — treat this as a hard constraint, not a suggestion:
- source visible physical-attractiveness score: ${profile.physicalAttractivenessScore}/9
- generated-partner target score: approximately ${compensatedTarget}/9; never visibly exceed the source score
- source grooming: ${profile.grooming}
- source styling effort: ${profile.styleEffort}
- source photographic polish: ${profile.photoPolish}
- source expression: ${profile.expression}
- source broad adult-age presentation: ${profile.agePresentation}

The target is intentionally one point below the source score to counter the image model's tendency to idealise a generated ${partnerGender}. Do not compensate by improving the source person. Match the partner's grooming, styling effort, expression and photographic polish to the source classifications exactly. If a user-selected option conflicts with this calibration, the calibration wins.`;
}
