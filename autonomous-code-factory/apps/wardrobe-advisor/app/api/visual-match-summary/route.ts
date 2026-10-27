import { NextResponse } from "next/server";
import { analyseVisualMatch, parseVisualMatchAnalysis } from "@/lib/visual-match-analysis";
import { selectedVisionProvider, VisionProviderError } from "@/lib/vision-analysis";

export const runtime = "nodejs";

const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function errorResponse(error: string, status: number, requestId: string) {
  return NextResponse.json({ error, requestId }, { status, headers: { "X-Request-ID": requestId } });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const form = await request.formData();
  const image = form.get("image");
  if (!(image instanceof File) || !supportedImageTypes.has(image.type)) {
    return errorResponse("Please provide the generated JPEG, PNG or WebP image.", 400, requestId);
  }
  if (image.size > 10 * 1024 * 1024) return errorResponse("The generated image is too large to analyse.", 413, requestId);

  try {
    const result = await analyseVisualMatch(Buffer.from(await image.arrayBuffer()).toString("base64"), image.type);
    if (!result.outputText) return errorResponse("No visual-match summary was returned.", 502, requestId);
    const analysis = parseVisualMatchAnalysis(result.outputText);
    if (!analysis) return errorResponse("The visual-match summary was incomplete. Please retry.", 502, requestId);
    return NextResponse.json(analysis, { headers: { "X-Request-ID": requestId, "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof VisionProviderError) {
      console.error(JSON.stringify({ event: "visual_match_summary_provider_error", requestId, selectedProvider: selectedVisionProvider(), ...error.details }));
      const configurationError = error.details.providerCode?.startsWith("missing_") || error.details.providerCode === "unsupported_vision_provider";
      return errorResponse(error.message, configurationError || error.details.providerStatus === 429 ? 503 : error.details.providerStatus ? 502 : 504, requestId);
    }
    console.error(JSON.stringify({ event: "visual_match_summary_unexpected_error", requestId, error: error instanceof Error ? error.message : "unknown_error" }));
    return errorResponse("The visual-match summary could not be created.", 502, requestId);
  }
}
