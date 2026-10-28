import { NextResponse } from "next/server";
import { analyseDatingPhoto, datingSubjectModes, parseDatingPhotoRating, type DatingSubjectMode } from "@/lib/rate-me";
import { VisionProviderError } from "@/lib/vision-analysis";

export const runtime = "nodejs";

const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function errorResponse(error: string, status: number, requestId: string) {
  return NextResponse.json({ error, requestId }, { status, headers: { "X-Request-ID": requestId } });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const form = await request.formData();
  const image = form.get("image");
  const subjectMode = form.get("subjectMode");
  const adultConfirmed = form.get("adultConfirmed") === "true";
  if (!adultConfirmed) return errorResponse("Confirm that everyone shown is 18+ and consented to appearance feedback.", 400, requestId);
  if (!(image instanceof File) || !supportedImageTypes.has(image.type)) {
    return errorResponse("Please upload a JPEG, PNG, WebP or non-animated GIF image.", 400, requestId);
  }
  if (typeof subjectMode !== "string" || !datingSubjectModes.includes(subjectMode as DatingSubjectMode)) {
    return errorResponse("Choose AI decides, Rate a man or Rate a woman.", 400, requestId);
  }
  if (image.size > 10 * 1024 * 1024) return errorResponse("Please choose an image under 10 MB.", 413, requestId);

  try {
    const result = await analyseDatingPhoto(Buffer.from(await image.arrayBuffer()).toString("base64"), image.type, subjectMode as DatingSubjectMode);
    if (!result.outputText) return errorResponse("No rating was returned. Please try again.", 502, requestId);
    const analysis = parseDatingPhotoRating(result.outputText);
    if (!analysis) return errorResponse("The rating was incomplete. Please retry.", 502, requestId);
    return NextResponse.json(analysis, { headers: { "X-Request-ID": requestId } });
  } catch (error) {
    if (error instanceof VisionProviderError) {
      console.error(JSON.stringify({ event: "dating_photo_provider_error", requestId, ...error.details }));
      const configuration = error.details.providerCode?.startsWith("missing_") || error.details.providerCode === "unsupported_vision_provider";
      const status = configuration || error.details.providerStatus === 429 ? 503 : error.details.providerStatus ? 502 : 504;
      return errorResponse(error.message, status, requestId);
    }
    console.error(JSON.stringify({ event: "dating_photo_unexpected_error", requestId, error: error instanceof Error ? error.message : "unknown_error" }));
    return errorResponse("The photo rating service could not analyse this image.", 502, requestId);
  }
}
