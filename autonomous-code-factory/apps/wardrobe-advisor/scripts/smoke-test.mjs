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
