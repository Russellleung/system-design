import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const release = args.includes("--release");
const positional = args.filter((arg) => arg !== "--release");

if (positional.length > 1) {
  console.error("Usage: node scripts/preflight.mjs [--release] [project-directory]");
  process.exit(2);
}

const factoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const projectDir = positional[0] ? resolve(positional[0]) : null;
const results = [];

function add(level, name, ok, detail) {
  results.push({ level, name, ok, detail });
}

function commandVersion(command, versionArgs = ["--version"]) {
  const result = spawnSync(command, versionArgs, { encoding: "utf8", shell: false });
  if (result.error || result.status !== 0) return null;
  return `${result.stdout}${result.stderr}`.trim().split("\n")[0];
}

async function readable(path) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

const [major, minor] = process.versions.node.split(".").map(Number);
const supportedNode = major > 22 || (major === 22 && minor >= 13);
add("required", "Node.js >=22.13", supportedNode, `found ${process.version}`);

const gitVersion = commandVersion("git");
add("required", "Git", Boolean(gitVersion), gitVersion ?? "not found");

const dockerVersion = commandVersion("docker");
let dockerServer = dockerVersion;
if (release && dockerVersion) {
  const result = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8", shell: false });
  const reportedVersion = result.stdout.trim();
  dockerServer = result.status === 0 && /^\d+\.\d+/.test(reportedVersion) ? reportedVersion : null;
}
add(release ? "required" : "recommended", "Docker-compatible release runtime", Boolean(dockerVersion && dockerServer), dockerVersion ? (dockerServer ? `${dockerVersion}; engine ${dockerServer}` : "CLI found but engine unavailable") : "not found");

const rgVersion = commandVersion("rg");
add("recommended", "ripgrep", Boolean(rgVersion), rgVersion ?? "not found; agent-native search is acceptable");

const ghVersion = commandVersion("gh");
add("optional", "GitHub CLI", Boolean(ghVersion), ghVersion ?? "not found; use Git/plugin/web fallback");

const renderVersion = commandVersion("render");
add("optional", "Render CLI", Boolean(renderVersion), renderVersion ?? "not found; only needed for Render projects without MCP");

for (const relativePath of ["AGENTS.md", "CLAUDE.md", ".cursor/rules/factory.mdc", "docs/agent-onboarding.md", "skills/run-hackathon-mvp/SKILL.md"]) {
  add("required", relativePath, await readable(join(factoryRoot, relativePath)), "repository onboarding asset");
}

if (projectDir) {
  for (const filename of ["project.json", "PROJECT.md", "CHECKPOINT.md", "DECISIONS.md", "LESSONS.md"]) {
    add("required", filename, await readable(join(projectDir, filename)), projectDir);
  }

  try {
    const contract = JSON.parse(await readFile(join(projectDir, "project.json"), "utf8"));
    const commands = contract.verification?.commands;
    add("required", "Project verification commands", Array.isArray(commands) && commands.length > 0, Array.isArray(commands) ? `${commands.length} recorded` : "missing");
    add("required", "Project budget and permissions", Boolean(contract.budgets && contract.permissions), "project.json");
  } catch (error) {
    add("required", "Readable project contract", false, error.message);
  }
}

const labels = { required: "REQUIRED", recommended: "RECOMMENDED", optional: "OPTIONAL" };
for (const result of results) {
  const state = result.ok ? "PASS" : result.level === "required" ? "FAIL" : "WARN";
  console.log(`${state.padEnd(4)} ${labels[result.level].padEnd(11)} ${result.name} — ${result.detail}`);
}

console.log("\nManual checks: network/research access, browser/UI verification, provider authentication, secret availability, and external-action authority.");

const failures = results.filter((result) => result.level === "required" && !result.ok);
if (failures.length) {
  console.error(`\nPreflight failed: ${failures.length} required ${failures.length === 1 ? "capability" : "capabilities"} missing.`);
  process.exit(1);
}

console.log(`\nPreflight passed for ${release ? "release" : "local"} work.`);
