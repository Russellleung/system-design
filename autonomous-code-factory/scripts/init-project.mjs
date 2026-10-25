import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const factoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [slug, name, requestedRoot] = process.argv.slice(2);

if (!slug || !name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error('Usage: node scripts/init-project.mjs <kebab-case-slug> "<project name>" [output-root]');
  process.exit(1);
}

const outputRoot = resolve(requestedRoot ?? join(factoryRoot, "projects"));
const destination = join(outputRoot, slug);
const template = join(factoryRoot, "templates", "project");

await mkdir(outputRoot, { recursive: true });
await cp(template, destination, { recursive: true, errorOnExist: true, force: false });

const createdAt = new Date().toISOString();
const replacements = new Map([
  ["PROJECT_NAME", name],
  ["CREATED_AT", createdAt],
]);

for (const filename of ["PROJECT.md", "CHECKPOINT.md"]) {
  const path = join(destination, filename);
  let contents = await readFile(path, "utf8");
  for (const [needle, value] of replacements) contents = contents.replaceAll(needle, value);
  await writeFile(path, contents);
}

const contractPath = join(destination, "project.json");
const contract = JSON.parse(await readFile(contractPath, "utf8"));
contract.slug = slug;
contract.name = name;
await writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`);

console.log(`Created ${destination}`);
console.log(`Next: complete PROJECT.md and run node scripts/validate-project.mjs ${destination}`);
