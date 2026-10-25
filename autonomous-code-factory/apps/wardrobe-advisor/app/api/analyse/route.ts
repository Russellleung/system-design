import { NextResponse } from "next/server";

export const runtime = "edge";

const outputRules = `Return only JSON with: styleName, styleSummary, palette (five hex colours), garments (id, category, colour, style), gaps (name, reason, priority as High or Useful, query), and confidenceNote. List at most 15 visible garment groups and exactly three gaps. Ground every claim in visible clothes. Never infer gender, age, body shape, income, ethnicity, religion, health, or other sensitive traits. Never claim one photo is the user's complete wardrobe. Recommend versatile pieces that do not duplicate visible items.`;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Live visual analysis is not connected yet. Add the server-side OPENAI_API_KEY secret to enable it." },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const image = form.get("image");
  if (!(image instanceof File) || !image.type.startsWith("image/")) {
    return NextResponse.json({ error: "Please upload a valid image." }, { status: 400 });
  }
  if (image.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Please choose an image under 10 MB." }, { status: 413 });
  }

  const bytes = new Uint8Array(await image.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  const dataUrl = `data:${image.type};base64,${btoa(binary)}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5-mini",
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: `Analyse the visible wardrobe in this photo. ${outputRules}` },
          { type: "input_image", image_url: dataUrl, detail: "high" },
        ],
      }],
      text: { format: { type: "json_object" } },
      max_output_tokens: 1800,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "The vision service could not analyse this photo. Please try again." }, { status: 502 });
  }

  const result = await response.json() as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  const outputText = result.output_text ?? result.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text")?.text;

  if (!outputText) return NextResponse.json({ error: "No analysis was returned." }, { status: 502 });
  try {
    return NextResponse.json(JSON.parse(outputText));
  } catch {
    return NextResponse.json({ error: "The analysis response was incomplete. Please retry." }, { status: 502 });
  }
}
