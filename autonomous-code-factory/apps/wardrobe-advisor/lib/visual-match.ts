export const visualMatchOptions = {
  height: ["ai", "very-tall", "tall", "similar", "short", "very-short"],
  build: ["ai", "slim", "average", "athletic", "muscular", "curvy", "plus-size"],
  appearance: ["ai", "east-asian", "southeast-asian", "south-asian", "black", "white", "hispanic-latina", "middle-eastern", "mixed"],
  age: ["ai", "similar-adult-age", "slightly-younger-adult", "slightly-older-adult"],
  style: ["ai", "casual", "elegant", "sporty", "alternative", "professional", "streetwear"],
  energy: ["ai", "warm", "confident", "reserved", "playful", "glamorous"],
  pose: ["ai", "standing-together", "arm-around", "holding-hands", "seated", "laughing-candidly"],
  setting: ["ai", "cafe", "city", "beach", "formal-event", "hiking", "home"],
  placement: ["right", "left"],
} as const;

export type VisualMatchSelections = {
  [Key in keyof typeof visualMatchOptions]: (typeof visualMatchOptions)[Key][number];
};

export type GeneratedVisualMatch = {
  imageBase64: string;
  mimeType: string;
  providerRequestId?: string | null;
};

export class VisualMatchProviderError extends Error {
  constructor(
    message: string,
    readonly details: {
      provider: "cloudflare" | "gemini";
      model: string;
      providerStatus?: number;
      providerRequestId?: string | null;
      providerCode?: string;
      providerMessage?: string;
    },
  ) {
    super(message);
    this.name = "VisualMatchProviderError";
  }
}

export type VisualMatchProvider = "cloudflare" | "gemini";

export function selectedVisualMatchProvider(): VisualMatchProvider {
  const provider = process.env.VISUAL_MATCH_PROVIDER ?? "cloudflare";
  return provider === "gemini" ? "gemini" : "cloudflare";
}

function words(value: string) {
  return value.replaceAll("-", " ");
}

function selectionInstruction(key: keyof VisualMatchSelections, value: string) {
  if (value === "ai") return null;
  const labels: Record<keyof VisualMatchSelections, string> = {
    height: "relative height",
    build: "body build",
    appearance: "visual appearance",
    age: "apparent adult age",
    style: "clothing style",
    energy: "energy",
    pose: "couple pose",
    setting: "outfit context",
    placement: "position beside the source person",
  };
  return `${labels[key]}: ${words(value)}`;
}

export function buildVisualMatchPrompt(selections: VisualMatchSelections) {
  const chosen = (Object.entries(selections) as [keyof VisualMatchSelections, string][])
    .map(([key, value]) => selectionInstruction(key, value))
    .filter(Boolean)
    .join("; ");

  const facingDirection = selections.placement === "right" ? "slightly toward her left" : "slightly toward her right";
  return `Create one photorealistic, full-body fictional adult woman as an isolated subject for compositing into another photograph. She must clearly be at least 21 years old. Show her entire body from head to feet without cropping, with a natural affectionate-but-nonsexual couple-photo pose, looking ${facingDirection} toward a person who will be added later.

${chosen ? `Use these selected attributes: ${chosen}.` : "Choose visually coherent adult features, clothing and energy. Do not imply psychological, biological or racial compatibility."}

Use a perfectly flat, evenly lit chroma-key green (#00FF00) background with no scenery, floor, furniture, props, text, logo, watermark or green clothing. Do not cast a shadow onto the green background. Keep a clean, sharp outline around hair, clothes and limbs. Output exactly one person.`;
}

function extractImage(result: Record<string, unknown>) {
  const outputImage = typeof result.output_image === "object" && result.output_image !== null
    ? result.output_image as Record<string, unknown>
    : null;
  if (outputImage && typeof outputImage.data === "string") {
    return {
      imageBase64: outputImage.data,
      mimeType: typeof outputImage.mime_type === "string" ? outputImage.mime_type : "image/png",
    };
  }

  const steps = Array.isArray(result.steps) ? result.steps : [];
  for (const step of steps) {
    if (typeof step !== "object" || step === null) continue;
    const content = (step as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (typeof block !== "object" || block === null) continue;
      const record = block as Record<string, unknown>;
      if (record.type === "image" && typeof record.data === "string") {
        return {
          imageBase64: record.data,
          mimeType: typeof record.mime_type === "string" ? record.mime_type : "image/png",
        };
      }
    }
  }
  return null;
}

function detectImageMime(imageBase64: string) {
  if (imageBase64.startsWith("iVBOR")) return "image/png";
  if (imageBase64.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

async function generateWithGemini(
  selections: VisualMatchSelections,
): Promise<GeneratedVisualMatch> {
  const provider = "gemini" as const;
  const model = process.env.GEMINI_IMAGE_MODEL;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!model) {
    throw new VisualMatchProviderError(
      "Visual Match is built but image generation is not enabled. The current Gemini image models are paid-only.",
      { provider, model: "not-configured", providerCode: "missing_gemini_image_model" },
    );
  }
  if (!apiKey) {
    throw new VisualMatchProviderError("Visual Match is not connected to Gemini yet.", {
      provider, model,
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
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model,
        input: [{ type: "text", text: buildVisualMatchPrompt(selections) }],
        response_format: {
          type: "image",
          mime_type: "image/jpeg",
          aspect_ratio: "4:5",
          image_size: "1K",
        },
      }),
    });
  } catch (error) {
    throw new VisualMatchProviderError("Image generation timed out or could not be reached. Please try again.", {
      provider, model,
      providerCode: error instanceof Error ? error.name : "transport_error",
    });
  }

  const providerRequestId = response.headers.get("x-request-id") ?? response.headers.get("x-guploader-uploadid");
  const responseText = await response.text();
  let result: Record<string, unknown>;
  try {
    result = JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    throw new VisualMatchProviderError("Gemini returned an invalid image response.", {
      provider, model,
      providerStatus: response.status,
      providerRequestId,
      providerCode: "invalid_provider_response",
    });
  }

  if (!response.ok) {
    const providerError = typeof result.error === "object" && result.error !== null
      ? result.error as Record<string, unknown>
      : {};
    const message = response.status === 429
      ? "Image generation has reached its usage limit. Please try again later."
      : response.status === 401 || response.status === 403
        ? "Image generation is not enabled for this Gemini account."
        : "Gemini could not create this visual match. Please try another photo.";
    throw new VisualMatchProviderError(message, {
      provider, model,
      providerStatus: response.status,
      providerRequestId,
      providerCode: typeof providerError.status === "string" ? providerError.status : undefined,
      providerMessage: typeof providerError.message === "string" ? providerError.message : undefined,
    });
  }

  const image = extractImage(result);
  if (!image) {
    throw new VisualMatchProviderError("Gemini completed the request but did not return an image.", {
      provider, model,
      providerRequestId,
      providerCode: "missing_output_image",
    });
  }

  return { ...image, providerRequestId };
}

async function generateWithCloudflare(
  selections: VisualMatchSelections,
): Promise<GeneratedVisualMatch> {
  const provider = "cloudflare" as const;
  const model = process.env.CLOUDFLARE_IMAGE_MODEL ?? "@cf/black-forest-labs/flux-2-klein-4b";
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new VisualMatchProviderError(
      "Visual Match needs its free Cloudflare Workers AI connection configured.",
      { provider, model, providerCode: "missing_cloudflare_credentials" },
    );
  }

  const form = new FormData();
  form.append("prompt", buildVisualMatchPrompt(selections));
  form.append("width", "768");
  form.append("height", "1024");

  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}` },
        body: form,
        signal: AbortSignal.timeout(120_000),
      },
    );
  } catch (error) {
    throw new VisualMatchProviderError("Cloudflare image generation timed out or could not be reached.", {
      provider,
      model,
      providerCode: error instanceof Error ? error.name : "transport_error",
    });
  }

  const providerRequestId = response.headers.get("cf-ray");
  const responseText = await response.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    throw new VisualMatchProviderError("Cloudflare returned an invalid image response.", {
      provider, model, providerStatus: response.status, providerRequestId, providerCode: "invalid_provider_response",
    });
  }

  const result = typeof payload.result === "object" && payload.result !== null
    ? payload.result as Record<string, unknown>
    : {};
  if (!response.ok || payload.success === false) {
    const errors = Array.isArray(payload.errors) ? payload.errors : [];
    const firstError = typeof errors[0] === "object" && errors[0] !== null
      ? errors[0] as Record<string, unknown>
      : {};
    const quotaExceeded = response.status === 429 || firstError.code === 3040;
    throw new VisualMatchProviderError(
      quotaExceeded
        ? "The free daily image-generation allowance has been used. Please try again after 00:00 UTC."
        : response.status === 401 || response.status === 403
          ? "Cloudflare Workers AI is not configured correctly."
          : "Cloudflare could not create this visual match. Please try another photo.",
      {
        provider,
        model,
        providerStatus: response.status,
        providerRequestId,
        providerCode: typeof firstError.code === "number" || typeof firstError.code === "string" ? String(firstError.code) : undefined,
        providerMessage: typeof firstError.message === "string" ? firstError.message : undefined,
      },
    );
  }

  if (typeof result.image !== "string" || result.image.length === 0) {
    throw new VisualMatchProviderError("Cloudflare completed the request but did not return an image.", {
      provider, model, providerRequestId, providerCode: "missing_output_image",
    });
  }

  return { imageBase64: result.image, mimeType: detectImageMime(result.image), providerRequestId };
}

export function generateVisualMatch(
  selections: VisualMatchSelections,
) {
  return selectedVisualMatchProvider() === "gemini"
    ? generateWithGemini(selections)
    : generateWithCloudflare(selections);
}
