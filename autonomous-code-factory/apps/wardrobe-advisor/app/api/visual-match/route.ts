import { NextResponse } from "next/server";
import {
  generateVisualMatch,
  selectedVisualMatchProvider,
  type VisualMatchSelections,
  VisualMatchProviderError,
  visualMatchOptions,
} from "@/lib/visual-match";
import { analyseVisualMatchProfile, parseVisualMatchProfile } from "@/lib/visual-match-profile";
import { selectedVisionProvider, VisionProviderError } from "@/lib/vision-analysis";

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
  const mask = form.get("mask");
  if (form.get("adultConfirmed") !== "true") {
    return errorResponse("Confirm that everyone in the uploaded photo is an adult and has consented.", 400, requestId);
  }
  if (!(image instanceof File) || !supportedImageTypes.has(image.type)) {
    return errorResponse("Please upload a JPEG, PNG or WebP image.", 400, requestId);
  }
  if (image.size > 10 * 1024 * 1024) {
    return errorResponse("Please choose an image under 10 MB.", 413, requestId);
  }
  if (!(mask instanceof File) || mask.type !== "image/png") {
    return errorResponse("The visual-match edit mask is missing or invalid.", 400, requestId);
  }
  if (mask.size > 4 * 1024 * 1024) {
    return errorResponse("The visual-match edit mask is too large.", 413, requestId);
  }
  const outputSize = form.get("outputSize");
  if (typeof outputSize !== "string" || !/^\d{2,4}x\d{2,4}$/.test(outputSize)) {
    return errorResponse("The visual-match output dimensions are invalid.", 400, requestId);
  }
  const [outputWidth, outputHeight] = outputSize.split("x").map(Number);
  if (outputWidth % 16 || outputHeight % 16 || outputWidth > 2160 || outputHeight > 2160 || outputWidth / outputHeight > 3 || outputHeight / outputWidth > 3) {
    return errorResponse("The visual-match output dimensions are unsupported.", 400, requestId);
  }
  const selections = parseSelections(form);
  if (!selections) return errorResponse("One or more visual-match options are invalid.", 400, requestId);

  try {
    const imageBase64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    const maskBase64 = Buffer.from(await mask.arrayBuffer()).toString("base64");
    const profileResult = await analyseVisualMatchProfile(imageBase64, image.type);
    if (!profileResult.outputText) return errorResponse("The source-photo calibration returned no result. Please retry.", 502, requestId);
    const profile = parseVisualMatchProfile(profileResult.outputText);
    if (!profile) return errorResponse("The source-photo calibration was incomplete. Please retry.", 502, requestId);
    const result = await generateVisualMatch(imageBase64, image.type, maskBase64, outputSize, selections, profile);
    return NextResponse.json(
      { imageBase64: result.imageBase64, mimeType: result.mimeType },
      { headers: { "X-Request-ID": requestId, "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof VisionProviderError) {
      console.error(JSON.stringify({ event: "visual_match_profile_provider_error", requestId, selectedProvider: selectedVisionProvider(), ...error.details }));
      const configurationError = error.details.providerCode?.startsWith("missing_") || error.details.providerCode === "unsupported_vision_provider";
      return errorResponse(error.message, configurationError || error.details.providerStatus === 429 ? 503 : error.details.providerStatus ? 502 : 504, requestId);
    }
    if (error instanceof VisualMatchProviderError) {
      console.error(JSON.stringify({ event: "visual_match_provider_error", requestId, selectedProvider: selectedVisualMatchProvider(), ...error.details }));
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
