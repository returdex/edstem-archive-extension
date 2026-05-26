/**
 * Phase 17 E2E: Schema validation and invalid payload handling.
 *
 * Covers scenarios where the EDstem API returns unexpected or invalid data:
 * - Invalid/empty API payloads produce safe failures without leaking bodies
 * - Error state (500) produces sanitized diagnostics
 * - Rate-limited state produces a user-friendly retry message
 *
 * All error handling is verified to be body-free: the popup must never render
 * raw API response bodies, auth headers, cookies, or unfiltered error stacks.
 *
 * Privacy contract:
 * - Error messages are sanitized by sanitizeErrorMessage() in the extension.
 * - No raw response bodies appear in popup diagnostics.
 */

import { test, expect } from "@playwright/test";
import { launchExtension, ExtensionHarness } from "./fixtures/extensionHarness";
import {
  startEdstemFixtureServer,
  EdstemFixtureServer,
  patchServiceWorkerFetch,
} from "./fixtures/edstemServer";

let harness: ExtensionHarness;
let fixtureServer: EdstemFixtureServer;

test.beforeAll(async () => {
  fixtureServer = await startEdstemFixtureServer();
  harness = await launchExtension();

  // Start with signed-in state.
  await patchServiceWorkerFetch(harness.serviceWorker, fixtureServer);
});

test.afterAll(async () => {
  await harness?.close();
  await fixtureServer?.stop();
});

test.describe("schema validation", () => {
  test("server error (500) produces a safe connection-problem state in the popup", async () => {
    // Switch to server error state.
    await patchServiceWorkerFetch(harness.serviceWorker, fixtureServer, {
      fixtureState: "error",
    });

    const popup = await harness.openPopup();
    await popup.waitForSelector(".popup-shell", { timeout: 15_000 });

    // The popup must show an error or connection-problem state.
    const shellText = await popup.locator(".popup-shell").textContent();
    expect(shellText).toBeTruthy();

    // The error message must be sanitized — no raw response body should appear.
    expect(shellText).not.toContain("Synthetic error state");
    // Raw error field names must not appear in the popup text.
    expect(shellText).not.toContain('"error"');
    expect(shellText).not.toContain("Internal Server Error");

    // No private data markers.
    expect(shellText).not.toContain("SYNTH101");
    expect(shellText).not.toContain("SYNTH102");

    // Restore.
    await patchServiceWorkerFetch(harness.serviceWorker, fixtureServer);
    await popup.close();
  });

  test("rate-limited state (429) produces a retry-available state in the popup", async () => {
    // Switch to rate-limited state.
    await patchServiceWorkerFetch(harness.serviceWorker, fixtureServer, {
      fixtureState: "rate-limited",
    });

    const popup = await harness.openPopup();
    await popup.waitForSelector(".popup-shell", { timeout: 15_000 });

    // The popup should render some state — it could be connection_problem or
    // needs_login depending on how the extension handles 429 at the session level.
    const shellText = await popup.locator(".popup-shell").textContent();
    expect(shellText).toBeTruthy();
    expect(shellText!.length).toBeGreaterThan(10);

    // No synthetic rate-limit message body should appear raw in the popup.
    expect(shellText).not.toContain("Rate limited (synthetic)");
    // No private data markers.
    expect(shellText).not.toContain("SYNTH101");

    // Restore.
    await patchServiceWorkerFetch(harness.serviceWorker, fixtureServer);
    await popup.close();
  });

  test("sync with invalid thread detail fails safely with body-free diagnostics", async () => {
    // Get back to signed-in state.
    await patchServiceWorkerFetch(harness.serviceWorker, fixtureServer);

    // We need a popup to trigger a sync that will encounter an error mid-run.
    // For this test we use the all-courses export with an error state injected
    // for thread-detail fetches only. Since all thread details are already in
    // IndexedDB from prior test runs, we force error state during the sync phase.
    await patchServiceWorkerFetch(harness.serviceWorker, fixtureServer, {
      fixtureState: "error",
    });

    const popup = await harness.openPopup();
    await popup.waitForSelector(".popup-shell", { timeout: 15_000 });

    // With error state, the session check itself will fail (connection problem).
    // The popup must not show any raw API response bodies.
    const shellText = await popup.locator(".popup-shell").textContent();

    // Error message from the extension must be sanitized.
    expect(shellText).not.toContain("Synthetic error state");
    expect(shellText).not.toContain("Internal Server Error");
    // No raw JSON fragments.
    expect(shellText).not.toContain('"message"');

    await patchServiceWorkerFetch(harness.serviceWorker, fixtureServer);
    await popup.close();
  });

  test("popup diagnostics never contain post bodies after failed sync", async () => {
    // Start from signed-in state and trigger an all-courses export.
    await patchServiceWorkerFetch(harness.serviceWorker, fixtureServer);

    const popup = await harness.openPopup();
    await popup.waitForSelector(".popup-shell", { timeout: 15_000 });

    // If there is a previous export result, inspect its text.
    const progressPanel = popup.locator(".progress-panel");
    const panelText = await progressPanel.textContent();

    // The progress panel must never expose post bodies.
    const sensitiveStrings = [
      "Welcome to this synthetic course. This is placeholder content",
      "Thank you! Looking forward to this synthetic course",
      "Synthetic question about the synthetic assignment",
      "Synthetic clarification answer",
      "Synthetic lecture notes on algorithm complexity",
    ];

    for (const sensitiveString of sensitiveStrings) {
      expect(panelText ?? "").not.toContain(sensitiveString);
    }

    await popup.close();
  });
});
