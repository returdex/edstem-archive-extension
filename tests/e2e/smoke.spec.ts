/**
 * Phase 17 E2E smoke tests for the browser extension.
 *
 * These tests verify the foundational E2E harness:
 * - The built MV3 extension loads in a persistent Chromium context.
 * - The extension service worker registers and an extension id is discoverable.
 * - The popup HTML can be opened via the chrome-extension:// URL.
 * - Synthetic EDstem fixture routes are reachable from the extension context.
 *
 * All fixture data is synthetic. No real EDstem course names, course IDs,
 * student names, instructor names, cookies, auth headers, or private thread
 * bodies appear anywhere in these tests.
 */

import { test, expect } from "@playwright/test";
import { launchExtension, ExtensionHarness } from "./fixtures/extensionHarness";
import { startEdstemFixtureServer, EdstemFixtureServer } from "./fixtures/edstemServer";

let harness: ExtensionHarness;
let fixtureServer: EdstemFixtureServer;

test.beforeAll(async () => {
  fixtureServer = await startEdstemFixtureServer();
  harness = await launchExtension();
});

test.afterAll(async () => {
  await harness?.close();
  await fixtureServer?.stop();
});

// ─── Extension smoke ──────────────────────────────────────────────────────────

test.describe("extension smoke", () => {
  test("extension loads and service worker is discoverable", async () => {
    // The harness constructor already discovered the service worker;
    // if we got here the extension loaded successfully.
    expect(harness.extensionId).toMatch(/^[a-z]{32}$/);
  });

  test("popup html opens via chrome-extension:// URL", async () => {
    const popup = await harness.openPopup();
    const url = popup.url();
    expect(url).toContain("chrome-extension://");
    expect(url).toContain("popup.html");

    // The popup must have the app container element defined in popup.html.
    const app = popup.locator("#app");
    await expect(app).toBeAttached();

    await popup.close();
  });

  test("popup html body renders the app container element", async () => {
    const popup = await harness.openPopup();
    // When opened as a chrome-extension:// full page, __MSG_ tokens in the
    // <title> are NOT substituted by Chrome — localisation only applies when
    // the popup is opened via the browser action button in a real browsing
    // context. This test verifies the DOM structure is present instead.
    const app = popup.locator("#app");
    await expect(app).toBeAttached();

    // The popup stylesheet link should be present in the document head.
    const styleLinks = popup.locator("link[rel=stylesheet]");
    await expect(styleLinks.first()).toBeAttached();

    await popup.close();
  });
});

// ─── Fixture smoke ────────────────────────────────────────────────────────────

test.describe("fixture server smoke", () => {
  test("fixture server is running and responds to /api/user", async ({ request }) => {
    const response = await request.get(`${fixtureServer.baseUrl}/api/user`);
    expect(response.status()).toBe(200);
    const body: unknown = await response.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("name");
  });

  test("fixture /api/user uses synthetic name without private markers", async ({ request }) => {
    const response = await request.get(`${fixtureServer.baseUrl}/api/user`);
    const body = (await response.json()) as Record<string, unknown>;
    const name = String(body["name"] ?? "");
    // Confirm no real private markers from the known-private list
    expect(name).not.toContain("SYNTH101");
    expect(name).not.toContain("SYNTH102");
    expect(name).not.toContain("10101");
    expect(name.length).toBeGreaterThan(0);
  });

  test("fixture /api/courses returns a synthetic course list", async ({ request }) => {
    const response = await request.get(`${fixtureServer.baseUrl}/api/courses`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    const courses = Array.isArray(body["courses"]) ? body["courses"] : [];
    expect(courses.length).toBeGreaterThan(0);
  });

  test("fixture auth-expired state returns 401", async ({ request }) => {
    const response = await request.get(`${fixtureServer.baseUrl}/api/user`, {
      headers: { "x-fixture-state": "auth-expired" },
    });
    expect(response.status()).toBe(401);
  });

  test("fixture rate-limit state returns 429", async ({ request }) => {
    const response = await request.get(`${fixtureServer.baseUrl}/api/user`, {
      headers: { "x-fixture-state": "rate-limited" },
    });
    expect(response.status()).toBe(429);
  });
});
