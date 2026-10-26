import { NextResponse } from "next/server";
import { parseTwinPortrait, synthesizeTwin, type TwinInputEntry } from "@/lib/digital-twin";
import { VisionProviderError } from "@/lib/vision-analysis";

export const runtime = "nodejs";

function errorResponse(error: string, status: number, requestId: string) {
  return NextResponse.json({ error, requestId }, { status, headers: { "X-Request-ID": requestId } });
}

function validEntry(value: unknown): value is TwinInputEntry {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && item.id.length <= 100
    && (item.kind === "thought" || item.kind === "moment")
    && typeof item.text === "string" && item.text.length <= 2000
    && typeof item.createdAt === "string" && !Number.isNaN(Date.parse(item.createdAt))
    && typeof item.hasPhoto === "boolean"
    && (item.photoName === undefined || (typeof item.photoName === "string" && item.photoName.length <= 200));
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let body: unknown;
  try { body = await request.json(); } catch { return errorResponse("Send a valid journal request.", 400, requestId); }
  const entries = typeof body === "object" && body !== null ? (body as Record<string, unknown>).entries : null;
  if (!Array.isArray(entries) || entries.length < 2 || entries.length > 30 || !entries.every(validEntry)) {
    return errorResponse("Add between 2 and 30 valid entries before generating a reflection.", 400, requestId);
  }
  const totalCharacters = entries.reduce((sum, entry) => sum + entry.text.length, 0);
  if (totalCharacters > 20_000) return errorResponse("The selected entries contain too much text. Keep the total below 20,000 characters.", 413, requestId);

  try {
    const result = await synthesizeTwin(entries);
    if (!result.outputText) return errorResponse("No reflection was returned.", 502, requestId);
    const portrait = parseTwinPortrait(result.outputText);
    if (!portrait) return errorResponse("The reflection was incomplete. Please retry.", 502, requestId);
    return NextResponse.json(portrait, { headers: { "X-Request-ID": requestId } });
  } catch (error) {
    if (error instanceof VisionProviderError) {
      console.error(JSON.stringify({ event: "digital_twin_provider_error", requestId, ...error.details }));
      const configuration = error.details.providerCode?.startsWith("missing_") || error.details.providerCode === "unsupported_vision_provider";
      const status = configuration || error.details.providerStatus === 429 ? 503 : error.details.providerStatus ? 502 : 504;
      return errorResponse(error.message, status, requestId);
    }
    console.error(JSON.stringify({ event: "digital_twin_unexpected_error", requestId, error: error instanceof Error ? error.message : "unknown_error" }));
    return errorResponse("The reflection service could not process these entries.", 502, requestId);
  }
}
