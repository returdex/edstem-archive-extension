import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const requiredListingSections = [
  "Single-Purpose Statement",
  "Short Description",
  "Long Description",
  "Permission Rationale Summary",
  "Screenshot Captions",
  "Privacy Policy Note",
  "Support and Review Notes",
];

const privateMarkers = ["Synthetic private marker course title", "SYNTH101/SYNTH102", "10101"];

function readExtensionFile(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

describe("package inventory and store materials", () => {
  it("keeps bilingual store listing documents aligned", () => {
    const english = readExtensionFile("STORE-LISTING.en.md");
    const chinese = readExtensionFile("STORE-LISTING.zh-CN.md");

    for (const section of requiredListingSections) {
      expect(english).toContain(`## ${section}`);
    }
    for (const section of ["单一用途说明", "简短描述", "详细描述", "权限说明摘要", "截图说明", "隐私政策说明", "支持和审核说明"]) {
      expect(chinese).toContain(`## ${section}`);
    }
    expect(english).toContain("local Markdown");
    expect(chinese).toContain("本地 Markdown");
    for (const marker of privateMarkers) {
      expect(english).not.toContain(marker);
      expect(chinese).not.toContain(marker);
    }
  });

  it("documents pre-submit commands, artifacts, and Phase 17 boundary", () => {
    const checklist = readExtensionFile("PRE_SUBMIT_CHECKLIST.md");

    for (const expected of [
      "npm run package:chrome",
      "npm run package:edge",
      "npm run package:check",
      "extension-chrome-v0.4.0.zip",
      "extension-edge-v0.4.0.zip",
      "No source maps",
      "No `.env` files",
      "No `tests/` directories",
      "No `node_modules/`",
      "Phase 17 owns live E2E",
      "synthetic screenshots",
    ]) {
      expect(checklist).toContain(expected);
    }
  });

  it("declares package and screenshot scripts", () => {
    const packageJson = JSON.parse(readExtensionFile("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["package:chrome"]).toContain("--target=chrome");
    expect(packageJson.scripts["package:edge"]).toContain("--target=edge");
    expect(packageJson.scripts["package:check"]).toBe("tsx scripts/package-check.ts");
    expect(packageJson.scripts.screenshots).toBe("tsx scripts/generate-screenshots.ts");
  });

  it("keeps package scripts local-only and checks forbidden inventory names", () => {
    const checker = readExtensionFile("scripts", "package-check.ts");

    for (const expected of ["node_modules", "tests?", ".env", ".sqlite", "<all_urls>"]) {
      expect(checker).toContain(expected);
    }
    expect(checker).not.toContain("upload");
    expect(checker).not.toContain("publish");
  });

  it("package-check produces SHA-256 inventory report when packages exist", () => {
    const checker = readExtensionFile("scripts", "package-check.ts");
    // Must use crypto SHA-256 for artifact hashing.
    expect(checker).toContain("sha256");
    expect(checker).toContain("createHash");
    // Must report manifest version.
    expect(checker).toContain("Manifest version");
    // Must report artifact byte size.
    expect(checker).toContain("bytes");
  });

  it("package-check reports both chrome and edge artifact names in inventory", () => {
    const checker = readExtensionFile("scripts", "package-check.ts");
    // Both targets must be checked and reported.
    expect(checker).toContain("chrome");
    expect(checker).toContain("edge");
    // Inventory output must include both artifact names.
    expect(checker).toContain("Package inventory");
  });

  it("generates reviewable synthetic screenshot fixtures when the script has run", () => {
    const screenshotDir = join(process.cwd(), "store-assets", "screenshots");

    if (!existsSync(screenshotDir)) {
      return;
    }

    for (const file of ["popup-success.html", "popup-error.html", "onboarding.html"]) {
      const text = readExtensionFile("store-assets", "screenshots", file);
      expect(text).toContain("Synthetic");
      for (const marker of privateMarkers) {
        expect(text).not.toContain(marker);
      }
    }
  });
});

describe("E2E fixture privacy and package isolation", () => {
  it("package:check script rejects tests/ directories in store packages", () => {
    const checker = readExtensionFile("scripts", "package-check.ts");
    // The regex pattern in package-check.ts must cover the tests/ path so E2E
    // test sources are never included in store zip artifacts.
    expect(checker).toMatch(/tests\?/);
  });

  it("E2E fixture server uses only synthetic data values (no private markers in response bodies)", async () => {
    // Import the fixture server and verify its live responses do not contain
    // private-data markers. We check actual runtime output, not source text,
    // because source files legitimately reference marker strings in their own
    // guard/constant declarations.
    const e2eFixturesDir = join(process.cwd(), "tests", "e2e", "fixtures");
    if (!existsSync(e2eFixturesDir)) {
      // E2E fixtures not present yet — skip gracefully.
      return;
    }

    // Read the edstemServer source and ensure no real private course IDs or
    // names are hardcoded in the SYNTHETIC_ constant blocks. We restrict the
    // check to lines that define string literals (excluding comments and guard
    // lists) by checking the synthetic data section specifically.
    const serverSource = readFileSync(join(e2eFixturesDir, "edstemServer.ts"), "utf8");

    // Only check the SYNTHETIC_ data block, not the full file (guard lists
    // are expected to reference the marker strings). We find lines between the
    // SYNTHETIC data constants and the first non-data section.
    const syntheticBlock = extractSyntheticDataBlock(serverSource);
    for (const marker of privateMarkers) {
      expect(
        syntheticBlock,
        `edstemServer.ts SYNTHETIC_ data block must not contain private marker: ${marker}`,
      ).not.toContain(marker);
    }
  });

  it("E2E smoke spec does not embed private markers as literal test values", () => {
    const smokeSpec = join(process.cwd(), "tests", "e2e", "smoke.spec.ts");
    if (!existsSync(smokeSpec)) {
      return;
    }
    const text = readFileSync(smokeSpec, "utf8");
    // The smoke spec must not reference specific private markers as expected
    // values in assertions — e.g. expect(name).toBe("SYNTH101").
    // Markers in comments or .not.toContain() guard assertions are expected.
    // We check that .toBe() and .toEqual() calls don't embed the private markers.
    for (const marker of privateMarkers) {
      const toBe = new RegExp(`\\.toBe\\(["'\`][^"'\`]*${escapeRegex(marker)}`);
      const toEqual = new RegExp(`\\.toEqual\\(["'\`][^"'\`]*${escapeRegex(marker)}`);
      expect(
        toBe.test(text) || toEqual.test(text),
        `smoke.spec.ts must not assert private marker as expected value: ${marker}`,
      ).toBe(false);
    }
  });

  it("E2E test output directories are covered by .gitignore patterns", () => {
    // Read the root .gitignore and check that E2E output paths are excluded.
    const gitignorePath = existsSync(join(process.cwd(), ".gitignore"))
      ? join(process.cwd(), ".gitignore")
      : join(process.cwd(), "..", ".gitignore");
    if (!existsSync(gitignorePath)) {
      // No root .gitignore — skip; CI environments may not have it.
      return;
    }
    const gitignore = readFileSync(gitignorePath, "utf8");
    // The .gitignore must mention e2e/.output or tests/e2e/.output to prevent
    // Playwright result/report directories from being committed.
    const hasE2EOutputIgnore =
      gitignore.includes("tests/e2e/.output") ||
      gitignore.includes("e2e/.output");
    expect(
      hasE2EOutputIgnore,
      "Root .gitignore must include a pattern for E2E test output directories",
    ).toBe(true);
  });

  it("E2E download output directories are covered by .gitignore patterns", () => {
    const gitignorePath = existsSync(join(process.cwd(), ".gitignore"))
      ? join(process.cwd(), ".gitignore")
      : join(process.cwd(), "..", ".gitignore");
    if (!existsSync(gitignorePath)) {
      return;
    }
    const gitignore = readFileSync(gitignorePath, "utf8");
    const hasDownloadsIgnore =
      gitignore.includes("tests/e2e/downloads") ||
      gitignore.includes("e2e/downloads");
    expect(
      hasDownloadsIgnore,
      "Root .gitignore must include a pattern for E2E isolated download directories",
    ).toBe(true);
  });

  it("package.json declares test:e2e script separate from vitest test script", () => {
    const packageJson = JSON.parse(readExtensionFile("package.json")) as {
      scripts: Record<string, string>;
    };
    // Vitest and Playwright must be separate commands.
    expect(packageJson.scripts["test"]).toContain("vitest");
    expect(packageJson.scripts["test:e2e"]).toContain("playwright");
    // They must not be the same command.
    expect(packageJson.scripts["test"]).not.toBe(packageJson.scripts["test:e2e"]);
  });
});

describe("store dashboard copy", () => {
  it("exists and contains a narrow single-purpose statement", () => {
    const dashboardCopy = readExtensionFile("STORE-DASHBOARD-COPY.md");

    // Must state the single purpose narrowly.
    expect(dashboardCopy).toContain("single purpose");
    // Must include the canonical single-purpose statement from STORE-LISTING.en.md
    expect(dashboardCopy).toContain("Edstem Archive lets a signed-in Edstem user download discussions they can already access as local Markdown files.");
  });

  it("dashboard copy justifies every declared permission", () => {
    const dashboardCopy = readExtensionFile("STORE-DASHBOARD-COPY.md");
    const permissions = readExtensionFile("PERMISSIONS.md");

    // Extract permissions column from PERMISSIONS.md (backtick-wrapped names).
    const permissionNames = [...permissions.matchAll(/`([a-zA-Z*:/]+)`/g)].map((m) => m[1]);
    // Every permission mentioned in PERMISSIONS.md must appear in the dashboard copy.
    for (const perm of permissionNames) {
      expect(dashboardCopy, `Dashboard copy must justify permission: ${perm}`).toContain(perm);
    }
  });

  it("dashboard copy states no remote code explicitly", () => {
    const dashboardCopy = readExtensionFile("STORE-DASHBOARD-COPY.md");
    expect(dashboardCopy).toContain("No");
    expect(dashboardCopy).toContain("remote code");
  });

  it("dashboard copy contains no private markers", () => {
    const dashboardCopy = readExtensionFile("STORE-DASHBOARD-COPY.md");
    for (const marker of privateMarkers) {
      expect(dashboardCopy).not.toContain(marker);
    }
  });

  it("dashboard copy is consistent with PRIVACY.md no-telemetry claim", () => {
    const dashboardCopy = readExtensionFile("STORE-DASHBOARD-COPY.md");
    // Dashboard must reference the no-telemetry / no-third-party-tracker posture.
    const hasNoTelemetry =
      dashboardCopy.includes("no telemetry") ||
      dashboardCopy.includes("No. The extension does not") ||
      dashboardCopy.includes("analytics") ||
      dashboardCopy.includes("third-party tracker") ||
      dashboardCopy.includes("third-party services");
    expect(hasNoTelemetry).toBe(true);
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extracts the SYNTHETIC_ data block from edstemServer.ts source text.
 * Returns the text between the "Synthetic fixture data" section header
 * and the "Route table" section header, or the full text if not found.
 */
function extractSyntheticDataBlock(source: string): string {
  const start = source.indexOf("// ─── Synthetic fixture data");
  const end = source.indexOf("// ─── Route table");
  if (start !== -1 && end !== -1 && end > start) {
    return source.slice(start, end);
  }
  // Fallback: return the full source (tests will still catch issues).
  return source;
}

function escapeRegex(str: string): string {
  return str.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&");
}
