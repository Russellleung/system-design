import { NextResponse } from "next/server";

export const runtime = "nodejs";

const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["styleName", "styleSummary", "palette", "garments", "gaps", "confidenceNote"],
  properties: {
    styleName: { type: "string" },
    styleSummary: { type: "string" },
    palette: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    },
    garments: {
      type: "array",
      maxItems: 15,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "category", "colour", "style"],
        properties: {
          id: { type: "string" },
          category: { type: "string" },
          colour: { type: "string" },
          style: { type: "string" },
        },
      },
    },
    gaps: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "reason", "priority", "query"],
        properties: {
          name: { type: "string" },
          reason: { type: "string" },
          priority: { type: "string", enum: ["High", "Useful"] },
          query: { type: "string" },
        },
      },
    },
    confidenceNote: { type: "string" },
  },
} as const;

const outputRules = `Return only JSON with: styleName, styleSummary, palette (five hex colours), garments (id, category, colour, style), gaps (name, reason, priority as High or Useful, query), and confidenceNote. List at most 15 visible garment groups and exactly three gaps. Ground every claim in visible clothes. Never infer gender, age, body shape, income, ethnicity, religion, health, or other sensitive traits. Never claim one photo is the user's complete wardrobe. Recommend versatile pieces that do not duplicate visible items.`;

function errorResponse(error: string, status: number, requestId: string) {
  return NextResponse.json(
    { error, requestId },
    { status, headers: { "X-Request-ID": requestId } },
  );
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(JSON.stringify({ event: "vision_configuration_error", requestId, reason: "missing_api_key" }));
    return errorResponse("Live visual analysis is not connected yet.", 503, requestId);
  }

  const form = await request.formData();
  const image = form.get("image");
  if (!(image instanceof File) || !supportedImageTypes.has(image.type)) {
    return errorResponse("Please upload a JPEG, PNG, WebP or non-animated GIF image.", 400, requestId);
  }
  if (image.size > 10 * 1024 * 1024) {
    return errorResponse("Please choose an image under 10 MB.", 413, requestId);
  }

  const dataUrl = `data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`;
  const model = process.env.OPENAI_VISION_MODEL ?? "gpt-5.4-mini";

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model,
        store: false,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: `Analyse the visible wardrobe in this photo. ${outputRules}` },
            { type: "input_image", image_url: dataUrl, detail: "high" },
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "wardrobe_analysis",
            strict: true,
            schema: analysisSchema,
          },
        },
        max_output_tokens: 1800,
      }),
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "vision_transport_error",
      requestId,
      model,
      error: error instanceof Error ? error.message : "unknown_error",
    }));
    return errorResponse("The vision service timed out or could not be reached. Please try again.", 504, requestId);
  }

  const responseText = await response.text();
  let result: {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    error?: { code?: string; message?: string; type?: string };
  };
  try {
    result = JSON.parse(responseText);
  } catch {
    console.error(JSON.stringify({
      event: "vision_invalid_provider_response",
      requestId,
      model,
      providerStatus: response.status,
      providerRequestId: response.headers.get("x-request-id"),
    }));
    return errorResponse("The vision service returned an invalid response. Please try again.", 502, requestId);
  }

  if (!response.ok) {
    console.error(JSON.stringify({
      event: "vision_provider_error",
      requestId,
      model,
      providerStatus: response.status,
      providerRequestId: response.headers.get("x-request-id"),
      providerCode: result.error?.code,
      providerType: result.error?.type,
      providerMessage: result.error?.message,
    }));

    if (response.status === 401) {
      return errorResponse("Live analysis is not configured correctly.", 502, requestId);
    }
    if (response.status === 429) {
      return errorResponse("The analysis service has reached its usage limit. Please try again later.", 503, requestId);
    }
    return errorResponse("The vision service could not analyse this photo. Please try again.", 502, requestId);
  }

  const outputText = result.output_text ?? result.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text")?.text;

  if (!outputText) {
    console.error(JSON.stringify({ event: "vision_missing_output", requestId, model }));
    return errorResponse("No analysis was returned. Please try again.", 502, requestId);
  }
  try {
    return NextResponse.json(JSON.parse(outputText), { headers: { "X-Request-ID": requestId } });
  } catch {
    console.error(JSON.stringify({ event: "vision_invalid_json", requestId, model }));
    return errorResponse("The analysis response was incomplete. Please retry.", 502, requestId);
  }
}
