import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { isAllowedNetworkUrl } from "../src/policy/policyAllowlist";

export interface PolicyIssue {
  filePath: string;
  category: string;
  detail: string;
}

export const FORBIDDEN_PATTERNS = [
  { category: "broad host permission", pattern: /<all_urls>/ },
  { category: "sync storage", pattern: /chrome\.storage\.sync/ },
  { category: "console logging", pattern: /console\.(log|debug|info)\s*\(/ },
  { category: "dynamic code execution", pattern: /\beval\s*\(/ },
  { category: "dynamic code execution", pattern: /new\s+Function\b/ },
  { category: "remote script tag", pattern: /<script[^>]+src=["']https?:\/\//i },
  {
    category: "python cli path",
    pattern: /(?:^|[\\/])exports[\\/]|(?:^|[\\/])\.edstem(?:[\\/]|$)|local\.json|(?:^|[\\/])data[\\/]|\.sqlite/,
  },
  { category: "real course fixture", pattern: /Synthetic private marker course title|SYNTH101\/SYNTH102|10101/ },
  { category: "telemetry package", pattern: /posthog|analytics|sentry|datadog|segment|crash-report|fonts\.googleapis\.com/i },
  { category: "direct cookie api", pattern: /\b(?:chrome|browser)\.cookies\b/ },
  { category: "credential header construction", pattern: /\bAuthorization\b|\bBearer\b/ },
  { category: "browser token storage access", pattern: /\b(?:localStorage|sessionStorage)\b/ },
] as const;

const SOURCE_EXTENSIONS = new Set([".ts", ".js", ".html", ".css", ".json", ".md"]);

function isDocPath(filePath: string): boolean {
  return filePath.endsWith("PRIVACY.md") || filePath.endsWith("PERMISSIONS.md");
}

function shouldSkipPattern(filePath: string, category: string): boolean {
  if (isDocPath(filePath)) {
    return (
      category === "python cli path" ||
      category === "telemetry package" ||
      category === "sync storage"
    );
  }

  const normalized = filePath.replaceAll("\\", "/");
  if (normalized.endsWith("entrypoints/edstem.content.ts")) {
    return category === "browser token storage access";
  }
  if (normalized.includes(".output/chrome-mv3/content-scripts/")) {
    return (
      category === "browser token storage access" ||
      category === "console logging" ||
      category === "unallowlisted build output url"
    );
  }
  if (normalized.includes(".output/chrome-mv3/") && !normalized.endsWith("/manifest.json")) {
    return category === "broad host permission";
  }

  return false;
}

function fileExtension(filePath: string): string {
  const match = filePath.match(/(\.[^.\\/]*)$/);
  return match ? match[1] : "";
}

function collectFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const stat = statSync(root);
  if (stat.isFile()) {
    return SOURCE_EXTENSIONS.has(fileExtension(root)) ? [root] : [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const entryStat = statSync(path);

    if (entryStat.isDirectory()) {
      files.push(...collectFiles(path));
    } else if (SOURCE_EXTENSIONS.has(fileExtension(path))) {
      files.push(path);
    }
  }

  return files;
}

function literalUrls(text: string): string[] {
  const urls = new Set<string>();
  const urlPattern = /https?:\/\/[^\s"'<>`)]+/g;
  for (const match of text.matchAll(urlPattern)) {
    urls.add(match[0]);
  }

  return [...urls];
}

function literalFetchUrls(text: string): string[] {
  const urls = new Set<string>();
  const fetchPattern = /fetch\s*\(\s*["'](https?:\/\/[^"']+)["']/g;
  for (const match of text.matchAll(fetchPattern)) {
    urls.add(match[1]);
  }

  return [...urls];
}

export function scanTextForPolicyIssues(text: string, filePath: string): PolicyIssue[] {
  const issues: PolicyIssue[] = [];

  for (const { category, pattern } of FORBIDDEN_PATTERNS) {
    if (shouldSkipPattern(filePath, category)) {
      continue;
    }

    if (pattern.test(text)) {
      issues.push({ filePath, category, detail: String(pattern) });
    }
  }

  if (filePath.endsWith("entrypoints/background.ts")) {
    if (/setTimeout\s*\(/.test(text)) {
      issues.push({ filePath, category: "background timer", detail: "setTimeout" });
    }
    if (/setInterval\s*\(/.test(text)) {
      issues.push({ filePath, category: "background timer", detail: "setInterval" });
    }
  }

  for (const url of literalFetchUrls(text)) {
    if (!isAllowedNetworkUrl(url)) {
      issues.push({ filePath, category: "unallowlisted fetch target", detail: url });
    }
  }

  if (filePath.includes(`${join(".output", "chrome-mv3")}`)) {
    for (const url of literalUrls(text)) {
      if (!isAllowedNetworkUrl(url) && !shouldSkipPattern(filePath, "unallowlisted build output url")) {
        issues.push({ filePath, category: "unallowlisted build output url", detail: url });
      }
    }
  }

  return issues;
}

export function scanFiles(paths: string[]): PolicyIssue[] {
  const issues: PolicyIssue[] = [];

  for (const path of paths.flatMap(collectFiles)) {
    issues.push(...scanTextForPolicyIssues(readFileSync(path, "utf8"), path));
  }

  return issues;
}

export function defaultScanPaths(projectRoot = process.cwd()): string[] {
  return [
    join(projectRoot, "src"),
    join(projectRoot, "entrypoints"),
    join(projectRoot, "public"),
    join(projectRoot, "PRIVACY.md"),
    join(projectRoot, "PERMISSIONS.md"),
    join(projectRoot, ".output", "chrome-mv3"),
  ];
}

export function runPolicyCheck(projectRoot = process.cwd()): PolicyIssue[] {
  return scanFiles(defaultScanPaths(projectRoot));
}

function main(): void {
  const issues = runPolicyCheck();

  if (issues.length === 0) {
    return;
  }

  for (const issue of issues) {
    const displayPath = relative(process.cwd(), issue.filePath);
    process.stderr.write(`${displayPath}: ${issue.category} (${issue.detail})\n`);
  }

  process.exitCode = 1;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  main();
}
