import { describe, expect, it } from "vitest";

import { NETWORK_ALLOWLIST } from "../src/policy/policyAllowlist";
import { scanTextForPolicyIssues } from "../scripts/policy-check";

function categoriesFor(text: string, filePath = "src/example.ts"): string[] {
  return scanTextForPolicyIssues(text, filePath).map((issue) => issue.category);
}

describe("policy guardrails", () => {
  it("requires documented allowlist entries", () => {
    expect(NETWORK_ALLOWLIST).toEqual([
      expect.objectContaining({
        pattern: "https://edstem.org/*",
        reason: expect.any(String),
        phase: expect.stringContaining("Phase"),
        requirement: expect.stringContaining("EXTPRIVACY"),
      }),
      expect.objectContaining({
        pattern: "https://*.edstem.org/*",
        reason: expect.any(String),
        phase: expect.stringContaining("Phase"),
        requirement: expect.stringContaining("EXTPRIVACY"),
      }),
    ]);
  });

  it.each([
    ["<all_urls>", "broad host permission"],
    ["chrome.storage.sync.set({})", "sync storage"],
    ["console.log('debug')", "console logging"],
    ["console.debug('debug')", "console logging"],
    ["console.info('debug')", "console logging"],
    ["eval('1 + 1')", "dynamic code execution"],
    ["new Function('return 1')", "dynamic code execution"],
    ["<script src=\"https://cdn.example.com/app.js\"></script>", "remote script tag"],
    ["fetch('https://example.com/api')", "unallowlisted fetch target"],
    ["exports/course.md", "python cli path"],
    [".edstem/course.json", "python cli path"],
    ["local.json", "python cli path"],
    ["data/archive.sqlite", "python cli path"],
    ["archive.sqlite", "python cli path"],
    ["Synthetic private marker course title", "real course fixture"],
    ["SYNTH101/SYNTH102", "real course fixture"],
    ["10101", "real course fixture"],
    ["posthog", "telemetry package"],
    ["sentry", "telemetry package"],
    ["fonts.googleapis.com", "telemetry package"],
    ["chrome.cookies.get({})", "direct cookie api"],
    ["browser.cookies.get({})", "direct cookie api"],
    ["Authorization: Bearer secret", "credential header construction"],
    ["localStorage.getItem('token')", "browser token storage access"],
    ["sessionStorage.getItem('token')", "browser token storage access"],
  ])("flags %s as %s", (text, category) => {
    expect(categoriesFor(text)).toContain(category);
  });

  it("flags timers in the background entrypoint only", () => {
    expect(categoriesFor("setTimeout(() => {}, 1)", "entrypoints/background.ts")).toContain(
      "background timer",
    );
    expect(categoriesFor("setInterval(() => {}, 1)", "entrypoints/background.ts")).toContain(
      "background timer",
    );
    expect(categoriesFor("setTimeout(() => {}, 1)", "src/popup.ts")).not.toContain(
      "background timer",
    );
  });

  it("allows documented Edstem-origin URLs", () => {
    expect(categoriesFor("fetch('https://edstem.org/api/user')")).not.toContain(
      "unallowlisted fetch target",
    );
    expect(categoriesFor("const url = 'https://foo.edstem.org/api/user'")).toEqual([]);
  });

  it("allows the Edstem content script to reuse in-page browser auth storage", () => {
    expect(
      categoriesFor("localStorage.getItem('auth')", "entrypoints/edstem.content.ts"),
    ).not.toContain("browser token storage access");
  });
});
