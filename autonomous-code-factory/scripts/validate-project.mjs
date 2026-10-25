import { access, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const projectDir = resolve(process.argv[2] ?? "");
if (!process.argv[2]) {
  console.error("Usage: node scripts/validate-project.mjs <project-directory>");
  process.exit(1);
}

const requiredFiles = ["project.json", "PROJECT.md", "CHECKPOINT.md", "DECISIONS.md", "LESSONS.md"];
const errors = [];

for (const filename of requiredFiles) {
  try { await access(join(projectDir, filename)); }
  catch { errors.push(`Missing ${filename}`); }
}

let contract;
try { contract = JSON.parse(await readFile(join(projectDir, "project.json"), "utf8")); }
catch (error) { errors.push(`Invalid project.json: ${error.message}`); }

if (contract) {
  if (contract.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(contract.slug ?? "")) errors.push("slug must be kebab-case");
  if (!contract.name?.trim()) errors.push("name is required");
  if (!contract.demoJourney?.trim() || contract.demoJourney.startsWith("Describe ")) errors.push("demoJourney must be completed");
  if (!Array.isArray(contract.acceptanceCriteria) || contract.acceptanceCriteria.length === 0) errors.push("at least one acceptance criterion is required");
  if ((contract.budgets?.cloudMonthlyTarget ?? -1) < 0) errors.push("cloudMonthlyTarget must be non-negative");
  if ((contract.budgets?.cloudMonthlyHardLimit ?? -1) < (contract.budgets?.cloudMonthlyTarget ?? 0)) errors.push("cloudMonthlyHardLimit must be at least the target");
  if (!Array.isArray(contract.verification?.commands)) errors.push("verification.commands must be an array");
}

if (errors.length) {
  console.error(errors.map((error) => `ERROR ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Project contract valid: ${projectDir}`);
