export const analysisSchema = {
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
      items: { type: "string" },
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

const wardrobePrompt = `Analyse only clothing visible in this wardrobe photograph. Return JSON matching the supplied schema. Use exactly five hexadecimal palette colours, at most 15 visible garment groups, and exactly three wardrobe gaps. Ground every claim in visible clothes. Never infer gender, age, body shape, income, ethnicity, religion, health, or other sensitive traits. Never claim one photo is the user's complete wardrobe. Recommend versatile pieces that do not duplicate visible items.`;

export type VisionProvider = "gemini" | "openai";

type ProviderResult = {
  outputText?: string;
  providerRequestId?: string | null;
};

function relaxSchemaForGemini(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(relaxSchemaForGemini);
  if (typeof value !== "object" || value === null) return value;

  const schema = value as Record<string, unknown>;
  const relaxed: Record<string, unknown> = {};

  if (typeof schema.type === "string") relaxed.type = schema.type;
  if (Array.isArray(schema.required)) relaxed.required = schema.required;
  if (typeof schema.properties === "object" && schema.properties !== null) {
    relaxed.properties = Object.fromEntries(
      Object.entries(schema.properties as Record<string, unknown>).map(([name, propertySchema]) => [
        name,
        relaxSchemaForGemini(propertySchema),
      ]),
    );
  }
  if ("items" in schema) relaxed.items = relaxSchemaForGemini(schema.items);

  return relaxed;
}

export class VisionProviderError extends Error {
  constructor(
    message: string,
    readonly details: {
      provider: string;
      model: string;
      providerStatus?: number;
      providerRequestId?: string | null;
      providerCode?: string;
      providerType?: string;
      providerMessage?: string;
    },
  ) {
    super(message);
    this.name = "VisionProviderError";
  }
}

function providerErrorMessage(status?: number) {
  if (status === 401 || status === 403) return "Live analysis is not configured correctly.";
  if (status === 429) return "The analysis service has reached its usage limit. Please try again later.";
  return "The vision service could not analyse this photo. Please try again.";
}

async function parseProviderResponse(
  response: Response,
  provider: VisionProvider,
  model: string,
): Promise<Record<string, unknown>> {
  const providerRequestId = response.headers.get("x-request-id")
    ?? response.headers.get("x-guploader-uploadid");
  const responseText = await response.text();
  let result: Record<string, unknown>;

  try {
    result = JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    throw new VisionProviderError("The vision service returned an invalid response. Please try again.", {
      provider,
      model,
      providerStatus: response.status,
      providerRequestId,
      providerCode: "invalid_provider_response",
    });
  }

  if (!response.ok) {
    const error = typeof result.error === "object" && result.error !== null
      ? result.error as Record<string, unknown>
      : {};
    throw new VisionProviderError(providerErrorMessage(response.status), {
      provider,
      model,
      providerStatus: response.status,
      providerRequestId,
      providerCode: typeof error.code === "string" ? error.code : undefined,
      providerType: typeof error.type === "string"
        ? error.type
        : typeof error.status === "string" ? error.status : undefined,
      providerMessage: typeof error.message === "string" ? error.message : undefined,
    });
  }

  return result;
}

function extractText(
  result: Record<string, unknown>,
  collectionName: "steps" | "output",
  contentType: "text" | "output_text",
) {
  if (typeof result.output_text === "string") return result.output_text;
  const collection = Array.isArray(result[collectionName]) ? result[collectionName] : [];
  for (const item of collection) {
    if (typeof item !== "object" || item === null) continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== "object" || part === null) continue;
      const record = part as Record<string, unknown>;
      if (record.type === contentType && typeof record.text === "string") return record.text;
    }
  }
  return undefined;
}

async function analyseWithGemini(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  schema: unknown,
): Promise<ProviderResult> {
  const provider = "gemini" as const;
  const model = process.env.GEMINI_VISION_MODEL ?? "gemini-3.5-flash-lite";
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new VisionProviderError("Live visual analysis is not connected yet.", {
      provider,
      model,
      providerCode: "missing_gemini_api_key",
    });
  }

  let response: Response;
  try {
    response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
        "Api-Revision": "2026-05-20",
      },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model,
        input: [
          { type: "text", text: prompt },
          { type: "image", data: imageBase64, mime_type: mimeType },
        ],
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema,
        },
      }),
    });
  } catch (error) {
    throw new VisionProviderError("The vision service timed out or could not be reached. Please try again.", {
      provider,
      model,
      providerCode: error instanceof Error ? error.name : "transport_error",
    });
  }

  const result = await parseProviderResponse(response, provider, model);
  return {
    outputText: extractText(result, "steps", "text"),
    providerRequestId: response.headers.get("x-request-id")
      ?? response.headers.get("x-guploader-uploadid"),
  };
}

async function analyseWithOpenAI(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  schema: unknown,
  schemaName: string,
): Promise<ProviderResult> {
  const provider = "openai" as const;
  const model = process.env.OPENAI_VISION_MODEL ?? "gpt-5.4-mini";
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new VisionProviderError("Live visual analysis is not connected yet.", {
      provider,
      model,
      providerCode: "missing_openai_api_key",
    });
  }

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
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: `data:${mimeType};base64,${imageBase64}`, detail: "high" },
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: schemaName,
            strict: true,
            schema,
          },
        },
        max_output_tokens: schemaName === "dating_photo_rating" ? 3200 : 1800,
      }),
    });
  } catch (error) {
    throw new VisionProviderError("The vision service timed out or could not be reached. Please try again.", {
      provider,
      model,
      providerCode: error instanceof Error ? error.name : "transport_error",
    });
  }

  const result = await parseProviderResponse(response, provider, model);
  return {
    outputText: extractText(result, "output", "output_text"),
    providerRequestId: response.headers.get("x-request-id"),
  };
}

async function analyseTextWithGemini(prompt: string, schema: unknown): Promise<ProviderResult> {
  const provider = "gemini" as const;
  const model = process.env.GEMINI_VISION_MODEL ?? "gemini-3.5-flash-lite";
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new VisionProviderError("Live reflection is not connected yet.", { provider, model, providerCode: "missing_gemini_api_key" });
  let response: Response;
  try {
    response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey, "Api-Revision": "2026-05-20" },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({ model, input: [{ type: "text", text: prompt }], response_format: { type: "text", mime_type: "application/json", schema } }),
    });
  } catch (error) {
    throw new VisionProviderError("The reflection service timed out or could not be reached.", { provider, model, providerCode: error instanceof Error ? error.name : "transport_error" });
  }
  const result = await parseProviderResponse(response, provider, model);
  return { outputText: extractText(result, "steps", "text"), providerRequestId: response.headers.get("x-request-id") ?? response.headers.get("x-guploader-uploadid") };
}

async function analyseTextWithOpenAI(prompt: string, schema: unknown, schemaName: string): Promise<ProviderResult> {
  const provider = "openai" as const;
  const model = process.env.OPENAI_VISION_MODEL ?? "gpt-5.4-mini";
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new VisionProviderError("Live reflection is not connected yet.", { provider, model, providerCode: "missing_openai_api_key" });
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model,
        store: false,
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
        text: { format: { type: "json_schema", name: schemaName, strict: true, schema } },
        max_output_tokens: 1800,
      }),
    });
  } catch (error) {
    throw new VisionProviderError("The reflection service timed out or could not be reached.", { provider, model, providerCode: error instanceof Error ? error.name : "transport_error" });
  }
  const result = await parseProviderResponse(response, provider, model);
  return { outputText: extractText(result, "output", "output_text"), providerRequestId: response.headers.get("x-request-id") };
}

export function selectedVisionProvider(): VisionProvider {
  const configured = (process.env.VISION_PROVIDER ?? "gemini").toLowerCase();
  if (configured === "gemini" || configured === "openai") return configured;
  throw new VisionProviderError("Live analysis is not configured correctly.", {
    provider: configured,
    model: "unknown",
    providerCode: "unsupported_vision_provider",
  });
}

export async function analyseStructuredImage(input: {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  schema: unknown;
  schemaName: string;
}) {
  const provider = selectedVisionProvider();
  const geminiSchema = input.schemaName === "dating_photo_rating"
    ? relaxSchemaForGemini(input.schema)
    : input.schema;
  return provider === "gemini"
    ? analyseWithGemini(input.imageBase64, input.mimeType, input.prompt, geminiSchema)
    : analyseWithOpenAI(input.imageBase64, input.mimeType, input.prompt, input.schema, input.schemaName);
}

export async function analyseStructuredText(input: { prompt: string; schema: unknown; schemaName: string }) {
  const provider = selectedVisionProvider();
  return provider === "gemini"
    ? analyseTextWithGemini(input.prompt, input.schema)
    : analyseTextWithOpenAI(input.prompt, input.schema, input.schemaName);
}

export async function analyseWardrobeImage(imageBase64: string, mimeType: string) {
  return analyseStructuredImage({
    imageBase64,
    mimeType,
    prompt: wardrobePrompt,
    schema: analysisSchema,
    schemaName: "wardrobe_analysis",
  });
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseWardrobeAnalysis(outputText: string): Record<string, unknown> | null {
  let value: unknown;
  try {
    value = JSON.parse(outputText);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;

  const analysis = value as Record<string, unknown>;
  const palette = analysis.palette;
  const garments = analysis.garments;
  const gaps = analysis.gaps;
  if (!isString(analysis.styleName) || !isString(analysis.styleSummary) || !isString(analysis.confidenceNote)) return null;
  if (!Array.isArray(palette) || palette.length !== 5 || !palette.every((colour) => typeof colour === "string" && /^#[0-9a-f]{6}$/i.test(colour))) return null;
  if (!Array.isArray(garments) || garments.length > 15 || !garments.every((garment) => {
    if (typeof garment !== "object" || garment === null) return false;
    const item = garment as Record<string, unknown>;
    return isString(item.id) && isString(item.category) && isString(item.colour) && isString(item.style);
  })) return null;
  if (!Array.isArray(gaps) || gaps.length !== 3 || !gaps.every((gap) => {
    if (typeof gap !== "object" || gap === null) return false;
    const item = gap as Record<string, unknown>;
    return isString(item.name)
      && isString(item.reason)
      && (item.priority === "High" || item.priority === "Useful")
      && isString(item.query);
  })) return null;

  return analysis;
}
