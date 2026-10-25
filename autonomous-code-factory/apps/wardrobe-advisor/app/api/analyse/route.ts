import { NextResponse } from "next/server";
import {
  analyseWardrobeImage,
  parseWardrobeAnalysis,
  selectedVisionProvider,
  VisionProviderError,
} from "@/lib/vision-analysis";

export const runtime = "nodejs";

const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function errorResponse(error: string, status: number, requestId: string) {
  return NextResponse.json(
    { error, requestId },
    { status, headers: { "X-Request-ID": requestId } },
  );
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const form = await request.formData();
  const image = form.get("image");
  if (!(image instanceof File) || !supportedImageTypes.has(image.type)) {
    return errorResponse("Please upload a JPEG, PNG, WebP or non-animated GIF image.", 400, requestId);
  }
  if (image.size > 10 * 1024 * 1024) {
    return errorResponse("Please choose an image under 10 MB.", 413, requestId);
  }

  try {
    const imageBase64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    const result = await analyseWardrobeImage(imageBase64, image.type);
    if (!result.outputText) {
      console.error(JSON.stringify({
        event: "vision_missing_output",
        requestId,
        provider: selectedVisionProvider(),
        providerRequestId: result.providerRequestId,
      }));
      return errorResponse("No analysis was returned. Please try again.", 502, requestId);
    }

    const analysis = parseWardrobeAnalysis(result.outputText);
    if (!analysis) {
      console.error(JSON.stringify({
        event: "vision_invalid_analysis",
        requestId,
        provider: selectedVisionProvider(),
        providerRequestId: result.providerRequestId,
      }));
      return errorResponse("The analysis response was incomplete. Please retry.", 502, requestId);
    }

    return NextResponse.json(analysis, { headers: { "X-Request-ID": requestId } });
  } catch (error) {
    if (error instanceof VisionProviderError) {
      console.error(JSON.stringify({
        event: "vision_provider_error",
        requestId,
        ...error.details,
      }));
      const isConfigurationError = error.details.providerCode?.startsWith("missing_")
        || error.details.providerCode === "unsupported_vision_provider";
      const status = isConfigurationError || error.details.providerStatus === 429
        ? 503
        : error.details.providerStatus === 401 || error.details.providerStatus === 403
          ? 502
          : error.details.providerStatus ? 502 : 504;
      return errorResponse(error.message, status, requestId);
    }

    console.error(JSON.stringify({
      event: "vision_unexpected_error",
      requestId,
      error: error instanceof Error ? error.message : "unknown_error",
    }));
    return errorResponse("The vision service could not analyse this photo. Please try again.", 502, requestId);
  }
}
