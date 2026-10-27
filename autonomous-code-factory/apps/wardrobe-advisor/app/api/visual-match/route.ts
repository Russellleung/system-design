import { NextResponse } from "next/server";
import {
  generateVisualMatch,
  type VisualMatchSelections,
  VisualMatchProviderError,
  visualMatchOptions,
} from "@/lib/visual-match";

export const runtime = "nodejs";

const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function errorResponse(error: string, status: number, requestId: string) {
  return NextResponse.json({ error, requestId }, { status, headers: { "X-Request-ID": requestId } });
}

function parseSelections(form: FormData): VisualMatchSelections | null {
  const parsed = {} as VisualMatchSelections;
  for (const [key, allowed] of Object.entries(visualMatchOptions) as [keyof VisualMatchSelections, readonly string[]][]) {
    const value = form.get(key);
    if (typeof value !== "string" || !allowed.includes(value)) return null;
    Object.assign(parsed, { [key]: value });
  }
  return parsed;
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const form = await request.formData();
  const image = form.get("image");
  if (form.get("adultConfirmed") !== "true") {
    return errorResponse("Confirm that everyone in the uploaded photo is an adult and has consented.", 400, requestId);
  }
  if (!(image instanceof File) || !supportedImageTypes.has(image.type)) {
    return errorResponse("Please upload a JPEG, PNG or WebP image.", 400, requestId);
  }
  if (image.size > 10 * 1024 * 1024) {
    return errorResponse("Please choose an image under 10 MB.", 413, requestId);
  }
  const selections = parseSelections(form);
  if (!selections) return errorResponse("One or more visual-match options are invalid.", 400, requestId);

  try {
    const imageBase64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    const result = await generateVisualMatch(imageBase64, image.type, selections);
    return NextResponse.json(
      { imageBase64: result.imageBase64, mimeType: result.mimeType },
      { headers: { "X-Request-ID": requestId, "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof VisualMatchProviderError) {
      console.error(JSON.stringify({ event: "visual_match_provider_error", requestId, ...error.details }));
      const configurationError = error.details.providerCode?.startsWith("missing_");
      return errorResponse(error.message, configurationError ? 503 : error.details.providerStatus ? 502 : 504, requestId);
    }
    console.error(JSON.stringify({
      event: "visual_match_unexpected_error",
      requestId,
      error: error instanceof Error ? error.message : "unknown_error",
    }));
    return errorResponse("Visual Match could not create this image. Please try again.", 502, requestId);
  }
}
