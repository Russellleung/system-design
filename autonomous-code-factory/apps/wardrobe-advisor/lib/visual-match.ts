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
      provider: "openai" | "cloudflare" | "gemini";
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

export type VisualMatchProvider = "openai" | "cloudflare" | "gemini";

export function selectedVisualMatchProvider(): VisualMatchProvider {
  const provider = process.env.VISUAL_MATCH_PROVIDER ?? "openai";
  if (provider === "gemini" || provider === "cloudflare") return provider;
  return "openai";
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
    setting: "partner outfit context (do not change the existing background)",
    placement: "position beside the source person",
  };
  return `${labels[key]}: ${words(value)}`;
}

export function buildVisualMatchPrompt(selections: VisualMatchSelections) {
  const chosen = (Object.entries(selections) as [keyof VisualMatchSelections, string][])
    .map(([key, value]) => selectionInstruction(key, value))
    .filter(Boolean)
    .join("; ");

  return `Edit only the transparent area in the supplied mask. Add exactly one fictional adult woman ${selections.placement === "right" ? "on the right side of the frame" : "on the left side of the frame"} so the result looks like an ordinary, candid photograph of two real adults together—not a dating advertisement, fashion shoot, travel campaign or idealised stock photo.

ABSOLUTE PRESERVATION RULE: do not modify anything in the opaque, protected part of the mask. Keep the original person exactly recognizable and unchanged: same face, expression, eyes, nose, mouth, jaw, skin texture, hair, body shape, pose, hands, clothes and accessories. This preservation rule also applies if any part of the original person accidentally extends into the transparent edit area. Never erase, crop, cover, replace, obscure or leave headless either person. Both people must have one complete, naturally connected head and face. Keep the protected environment unchanged: same background, objects, framing, crop, camera angle, perspective, lighting, shadows, colour grade, sharpness and resolution. Do not beautify, redraw, retouch, reshape, relight, move, age, de-age, replace or restyle the original person. If preservation conflicts with a requested pose or there is limited space, preserve the source person and make the added partner smaller or simplify her pose instead.

The added woman must clearly be at least 21 years old. Place her fully inside the editable area, matching the existing camera perspective, lighting, shadows, focus, grain and colour. Compose them as a close couple, not two separate subjects: anchor her at the inner edge of the editable area nearest the original person, with their shoulders or upper arms visually adjacent and only a very narrow natural gap (roughly 1–3% of the frame width). Do not centre her in the empty half or push her toward the outer edge. She may lean toward the original person and appear almost shoulder-to-shoulder, but must not cover or alter any protected source pixels. Interpret any requested interactive pose as a visual mood when literal contact would require changing protected pixels.

COUPLE MATCHING IS THE HIGHEST-PRIORITY GENERATION REQUIREMENT. The two people must look like believable visual peers with comparable apparent physical attractiveness and comparable presentation. First assess only what is visibly presented in the source photograph: apparent adult age, facial attractiveness, physique, grooming, styling, expression, confidence, photographic polish and overall visual presence. Then create a partner in the same narrow attractiveness and presentation band. Do not improve, restyle or beautify the source person to make the pairing seem more balanced.

Do not generate a fashion model, influencer, beauty-ad face or conspicuously camera-ready woman. Avoid the common generative default of flawless skin, highly symmetrical features, enlarged eyes, a sculpted jaw, glossy salon-styled hair, perfect bright teeth, heavy beauty makeup, an hourglass fashion silhouette or a polished promotional smile unless the source person visibly presents at that same level. Use normal skin texture, small natural asymmetries, ordinary believable proportions, restrained or no-visible makeup, everyday hair and realistic clothing. Match the source person's degree of grooming, wardrobe effort, facial expression and camera readiness. If the source is casual, neutrally expressive or plainly styled, the partner must be comparably casual, neutrally expressive and plainly styled. When uncertain, choose a more ordinary and less polished presentation rather than an aspirational one.

Match the couple aesthetically through coherent age, styling, colour palette, body language and social energy—not by copying facial features, matching ethnicity, or inferring personality, status or real compatibility. User-selected attributes are secondary constraints and must never push the partner into a higher presentation or attractiveness tier. A selected setting describes the partner's clothing context only; it never authorises replacing, upgrading or relocating the original background. Do not display or write an attractiveness score anywhere in the image.

${chosen ? `Use these selected attributes for the fictional partner: ${chosen}.` : "Choose visually coherent adult features, clothing and energy for the added partner. Do not imply psychological, biological or racial compatibility."}

Output the complete edited photograph, with exactly the original person plus one added fictional adult woman. Avoid duplicate people, extra limbs, text, logos and watermarks.`;
}

async function generateWithOpenAI(
  imageBase64: string,
  mimeType: string,
  maskBase64: string,
  outputSize: string,
  selections: VisualMatchSelections,
): Promise<GeneratedVisualMatch> {
  const provider = "openai" as const;
  const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-sunburst";
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new VisualMatchProviderError("Visual Match is not connected to OpenAI image editing yet.", {
      provider, model, providerCode: "missing_openai_api_key",
    });
  }

  const imageBytes = Uint8Array.from(Buffer.from(imageBase64, "base64"));
  const maskBytes = Uint8Array.from(Buffer.from(maskBase64, "base64"));
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", buildVisualMatchPrompt(selections));
  form.append("image", new Blob([imageBytes], { type: mimeType }), `portrait.${extension}`);
  form.append("mask", new Blob([maskBytes], { type: "image/png" }), "edit-mask.png");
  form.append("quality", process.env.OPENAI_IMAGE_QUALITY ?? "high");
  form.append("size", outputSize);
  form.append("output_format", "png");

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(180_000),
    });
  } catch (error) {
    throw new VisualMatchProviderError("OpenAI image editing timed out or could not be reached.", {
      provider, model, providerCode: error instanceof Error ? error.name : "transport_error",
    });
  }

  const providerRequestId = response.headers.get("x-request-id");
  const responseText = await response.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    throw new VisualMatchProviderError("OpenAI returned an invalid image response.", {
      provider, model, providerStatus: response.status, providerRequestId, providerCode: "invalid_provider_response",
    });
  }

  if (!response.ok) {
    const providerError = typeof payload.error === "object" && payload.error !== null
      ? payload.error as Record<string, unknown>
      : {};
    const message = response.status === 429
      ? "OpenAI image editing has reached its usage or billing limit."
      : response.status === 401 || response.status === 403
        ? "OpenAI image editing is not enabled for this account."
        : "OpenAI could not create this visual match. Please try another photo.";
    throw new VisualMatchProviderError(message, {
      provider,
      model,
      providerStatus: response.status,
      providerRequestId,
      providerCode: typeof providerError.code === "string" ? providerError.code : undefined,
      providerMessage: typeof providerError.message === "string" ? providerError.message : undefined,
    });
  }

  const data = Array.isArray(payload.data) ? payload.data : [];
  const first = typeof data[0] === "object" && data[0] !== null ? data[0] as Record<string, unknown> : {};
  if (typeof first.b64_json !== "string" || first.b64_json.length === 0) {
    throw new VisualMatchProviderError("OpenAI completed the request but did not return an image.", {
      provider, model, providerRequestId, providerCode: "missing_output_image",
    });
  }

  return { imageBase64: first.b64_json, mimeType: "image/png", providerRequestId };
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
  imageBase64: string,
  mimeType: string,
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
        input: [
          { type: "text", text: buildVisualMatchPrompt(selections) },
          { type: "image", data: imageBase64, mime_type: mimeType },
        ],
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
  imageBase64: string,
  mimeType: string,
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

  const imageBytes = Uint8Array.from(Buffer.from(imageBase64, "base64"));
  const form = new FormData();
  form.append("prompt", buildVisualMatchPrompt(selections));
  form.append("input_image_0", new Blob([imageBytes], { type: mimeType }), "portrait.jpg");
  form.append("width", "1024");
  form.append("height", "1280");

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
  imageBase64: string,
  mimeType: string,
  maskBase64: string,
  outputSize: string,
  selections: VisualMatchSelections,
) {
  const provider = selectedVisualMatchProvider();
  if (provider === "gemini") return generateWithGemini(imageBase64, mimeType, selections);
  if (provider === "cloudflare") return generateWithCloudflare(imageBase64, mimeType, selections);
  return generateWithOpenAI(imageBase64, mimeType, maskBase64, outputSize, selections);
}
