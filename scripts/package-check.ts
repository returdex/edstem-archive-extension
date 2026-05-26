import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, copyFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

const projectRoot = process.cwd();
const outputDir = join(projectRoot, ".output");
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8")) as { version: string };
const targets = ["chrome", "edge"] as const;
const forbiddenNamePatterns = [
  /\.map$/i,
  /(^|\/)node_modules\//i,
  /(^|\/)tests?\//i,
  /(^|\/)\.env/i,
  /local\.json/i,
  /\.sqlite$/i,
  /\.db$/i,
  /(^|\/)exports\//i,
  /(^|\/)\.edstem(\/|$)/i,
];
const privateMarkers = ["Synthetic private marker course title", "SYNTH101/SYNTH102", "10101"];

const args = new Set(process.argv.slice(2));
const targetArg = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1];

if (args.has("--rename")) {
  renameTarget(targetArg);
}

const checkTargets = targetArg && targets.includes(targetArg as (typeof targets)[number])
  ? [targetArg as (typeof targets)[number]]
  : [...targets];
const expectedZips = checkTargets.map((target) => join(outputDir, `extension-${target}-v${packageJson.version}.zip`));
const issues: string[] = [];

for (const zipPath of expectedZips) {
  if (!existsSync(zipPath)) {
    issues.push(`Missing package artifact: ${relative(projectRoot, zipPath)}`);
    continue;
  }
  for (const entry of listZipEntries(zipPath)) {
    if (forbiddenNamePatterns.some((pattern) => pattern.test(entry.replaceAll("\\", "/")))) {
      issues.push(`${basename(zipPath)} includes forbidden entry: ${entry}`);
    }
  }
}

for (const path of collectTextFiles(join(projectRoot, "store-assets"))) {
  const text = readFileSync(path, "utf8");
  for (const marker of privateMarkers) {
    if (text.includes(marker)) {
      issues.push(`${relative(projectRoot, path)} includes private marker: ${marker}`);
    }
  }
}

for (const manifestPath of [
  join(outputDir, "chrome-mv3", "manifest.json"),
  join(outputDir, "edge-mv3", "manifest.json"),
]) {
  if (existsSync(manifestPath)) {
    const manifestText = readFileSync(manifestPath, "utf8");
    if (manifestText.includes("<all_urls>")) {
      issues.push(`${relative(projectRoot, manifestPath)} includes broad host permission`);
    }
  }
}

// ─── Inventory report (printed to stdout unless --quiet) ─────────────────────

if (!args.has("--quiet")) {
  const inventoryLines: string[] = ["", "Package inventory:"];
  for (const zipPath of expectedZips) {
    const label = basename(zipPath);
    if (existsSync(zipPath)) {
      const sha256 = createHash("sha256").update(readFileSync(zipPath)).digest("hex");
      const sizeBytes = statSync(zipPath).size;
      inventoryLines.push(`  ${label} (${sizeBytes} bytes) SHA-256: ${sha256}`);
    } else {
      inventoryLines.push(`  ${label} — MISSING`);
    }
  }
  // Include manifest version from the first available built manifest.
  const manifestVersion = (() => {
    for (const manifestPath of [
      join(outputDir, "chrome-mv3", "manifest.json"),
      join(outputDir, "edge-mv3", "manifest.json"),
    ]) {
      if (existsSync(manifestPath)) {
        const m = JSON.parse(readFileSync(manifestPath, "utf8")) as { version?: string };
        return m.version ?? "unknown";
      }
    }
    return "unknown";
  })();
  inventoryLines.push(`  Manifest version: ${manifestVersion}`);
  for (const line of inventoryLines) {
    process.stdout.write(`${line}\n`);
  }
}

if (issues.length > 0) {
  for (const issue of issues) {
    process.stderr.write(`${issue}\n`);
  }
  process.exitCode = 1;
}

function renameTarget(target?: string): void {
  if (!target || !targets.includes(target as (typeof targets)[number])) {
    throw new Error("Use --target=chrome or --target=edge with --rename.");
  }
  const source = readdirSync(outputDir)
    .filter((name) => name.endsWith(`-${target}.zip`))
    .map((name) => join(outputDir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  if (!source) {
    throw new Error(`No WXT ${target} zip found in .output.`);
  }
  copyFileSync(source, join(outputDir, `extension-${target}-v${packageJson.version}.zip`));
}

function listZipEntries(zipPath: string): string[] {
  const buffer = readFileSync(zipPath);
  const entries: string[] = [];
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let offset = centralDirectoryOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`Invalid zip central directory in ${zipPath}`);
    }
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    entries.push(buffer.subarray(offset + 46, offset + 46 + filenameLength).toString("utf8"));
    offset += 46 + filenameLength + extraLength + commentLength;
  }
  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }
  throw new Error("Zip end-of-central-directory record not found.");
}

function collectTextFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }
  const stat = statSync(root);
  if (stat.isFile()) {
    return root.endsWith(".html") || root.endsWith(".md") || root.endsWith(".json") ? [root] : [];
  }
  return readdirSync(root).flatMap((entry) => collectTextFiles(join(root, entry)));
}
