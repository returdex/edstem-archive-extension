import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  EXPECTED_HOST_PERMISSIONS,
  EXPECTED_PERMISSIONS,
} from "../src/policy/permissionContract";

const forbiddenPermissions = [
  "cookies",
  "tabs",
  "webRequest",
  "webRequestBlocking",
  "nativeMessaging",
  "<all_urls>",
] as const;

function readExtensionFile(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

function parseGeneratedManifest(): Record<string, unknown> {
  const manifestPath = join(process.cwd(), ".output", "chrome-mv3", "manifest.json");

  if (!existsSync(manifestPath)) {
    throw new Error("Generated manifest not found. Run npm run build before npm test.");
  }

  return JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
}

describe("permission contract", () => {
  it("declares the exact expected manifest permissions", () => {
    expect(EXPECTED_PERMISSIONS).toEqual([
      "activeTab",
      "downloads",
      "notifications",
      "alarms",
      "storage",
    ]);
    expect(EXPECTED_HOST_PERMISSIONS).toEqual([
      "https://edstem.org/*",
      "https://*.edstem.org/*",
    ]);
  });

  it("does not include forbidden permissions in the contract", () => {
    const declared = [...EXPECTED_PERMISSIONS, ...EXPECTED_HOST_PERMISSIONS];

    for (const forbidden of forbiddenPermissions) {
      expect(declared).not.toContain(forbidden);
    }
  });

  it("documents every expected permission", () => {
    const permissionsDoc = readExtensionFile("PERMISSIONS.md");

    for (const permission of [...EXPECTED_PERMISSIONS, ...EXPECTED_HOST_PERMISSIONS]) {
      expect(permissionsDoc).toContain(`| \`${permission}\` |`);
    }
  });

  it("keeps privacy policy headings and guarantees visible", () => {
    const privacyDoc = readExtensionFile("PRIVACY.md");

    for (const heading of [
      "What the extension reads",
      "What the extension writes",
      "What the extension never does",
      "Network access",
      "Local storage",
      "Relationship to the Python CLI",
    ]) {
      expect(privacyDoc).toContain(`## ${heading}`);
    }

    expect(privacyDoc).toContain("No credentials or cookies are collected");
    expect(privacyDoc).toContain("telemetry, analytics, crash-reporting SDKs");
  });

  it("matches the generated Manifest V3 output", () => {
    const manifest = parseGeneratedManifest();

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.default_locale).toBe("en");
    expect(manifest.name).toBe("__MSG_manifestName__");
    expect(manifest.description).toBe("__MSG_manifestDescription__");
    expect((manifest.action as { default_title?: string }).default_title).toBe("__MSG_actionTitle__");
    expect(manifest.permissions).toEqual([...EXPECTED_PERMISSIONS]);
    expect(manifest.host_permissions).toEqual([...EXPECTED_HOST_PERMISSIONS]);

    const serializedManifest = JSON.stringify(manifest);
    for (const forbidden of forbiddenPermissions) {
      expect(serializedManifest).not.toContain(forbidden);
    }
  });

  it("keeps Phase 13 host scope limited to Edstem origins", () => {
    expect(EXPECTED_HOST_PERMISSIONS).toEqual([
      "https://edstem.org/*",
      "https://*.edstem.org/*",
    ]);
  });
});
