import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const extensionRoot = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(extensionRoot, path), "utf8");
}

function collectTextFiles(root: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...collectTextFiles(path));
    } else if (/\.(ts|html|css|json)$/.test(path)) {
      files.push(path);
    }
  }

  return files;
}

describe("standalone extension repository boundaries", () => {
  it("keeps the public repository extension-only", () => {
    expect(existsSync(join(extensionRoot, "package.json"))).toBe(true);
    expect(existsSync(join(extensionRoot, "pyproject.toml"))).toBe(false);
  });

  it("keeps extension generated and local artifacts ignored", () => {
    const gitignore = readProjectFile(".gitignore");

    for (const entry of [
      "dist/",
      ".output/",
      ".wxt/",
      "node_modules/",
      "*.zip",
      "tests/e2e/.output/",
    ]) {
      expect(gitignore).toContain(entry);
    }

    for (const existingEntry of ["sessions/", "data/", "exports/", "logs/", "local.json", "*.sqlite"]) {
      expect(gitignore).toContain(existingEntry);
    }
  });

  it("keeps production extension source away from Python CLI storage paths", () => {
    const productionFiles = [
      ...collectTextFiles(join(extensionRoot, "src")),
      ...collectTextFiles(join(extensionRoot, "entrypoints")),
    ];
    const cliPathPattern =
      /(?:^|[\\/])exports[\\/]|(?:^|[\\/])\.edstem(?:[\\/]|$)|local\.json|(?:^|[\\/])data[\\/]|\.sqlite/;

    for (const file of productionFiles) {
      expect(readFileSync(file, "utf8")).not.toMatch(cliPathPattern);
    }
  });

  it("documents package scripts for policy and full verification", () => {
    const packageJson = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["policy:check"]).toContain("policy-check");
    expect(packageJson.scripts.verify).toContain("npm run build");
    expect(packageJson.scripts.verify).toContain("npm test");
    expect(packageJson.scripts.verify).toContain("npm run policy:check");
  });
});
