const baseUrl = (process.env.APP_URL ?? "http://127.0.0.1:10000").replace(/\/$/, "");

async function requireResponse(path, assertion) {
  const response = await fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }
  await assertion(response);
  console.log(`PASS ${path}`);
}

await requireResponse("/api/health", async (response) => {
  const body = await response.json();
  if (body.status !== "ok" || body.service !== "closet-compass") {
    throw new Error(`Unexpected health response: ${JSON.stringify(body)}`);
  }
});

await requireResponse("/", async (response) => {
  const body = await response.text();
  if (!body.includes("Closet Compass")) {
    throw new Error("Homepage did not contain the product name");
  }
});

await requireResponse("/photo-coach", async (response) => {
  const body = await response.text();
  if (!body.includes("Coach the camera")) {
    throw new Error("Photo Coach page did not contain its primary heading");
  }
});

await requireResponse("/rate-me", async (response) => {
  const body = await response.text();
  if (!body.includes("Fine. Let")) throw new Error("Rate Me page did not contain its primary heading");
});

await requireResponse("/visual-match", async (response) => {
  const body = await response.text();
  if (!body.includes("Picture the chemistry")) throw new Error("Visual Match page did not contain its primary heading");
});

await requireResponse("/digital-twin", async (response) => {
  const body = await response.text();
  if (!body.includes("Build a twin")) throw new Error("Digital Twin page did not contain its primary heading");
});
