/**
 * Phase 17 E2E: Download current course workflow.
 *
 * Verifies the full popup -> background worker -> sync -> export -> Downloads
 * flow when the active tab is a synthetic EDstem course page.
 *
 * All fixture data is synthetic. The active tab is navigated to a synthetic
 * course URL only; no real EDstem login, cookies, or private content is used.
 *
 * Privacy contract:
 * - Discussion bodies appear only in the downloaded Markdown artifact.
 * - Popup diagnostics never include post bodies, auth headers, or tokens.
 * - Download filenames use sanitized synthetic identifiers only.
 */

import { test, expect } from "@playwright/test";
import { launchExtension, ExtensionHarness } from "./fixtures/extensionHarness";
import {
  startEdstemFixtureServer,
  EdstemFixtureServer,
  patchServiceWorkerFetch,
  patchServiceWorkerActiveTab,
} from "./fixtures/edstemServer";

let harness: ExtensionHarness;
let fixtureServer: EdstemFixtureServer;

test.beforeAll(async () => {
  fixtureServer = await startEdstemFixtureServer();
  harness = await launchExtension();

  // Patch the service worker's fetch so all https://edstem.org requests are
  // transparently redirected to the synthetic fixture server.
  await patchServiceWorkerFetch(harness.serviceWorker, fixtureServer);
});

test.afterAll(async () => {
  await harness?.close();
  await fixtureServer?.stop();
});

test.describe("current course download", () => {
  test("download current course button is enabled for matching active EDstem course tab", async () => {
    // Patch chrome.tabs.query in the service worker to simulate an active
    // EDstem course tab. This is necessary because in Playwright, opening the
    // popup page makes it the active tab, hiding the course page URL.
    await patchServiceWorkerActiveTab(
      harness.serviceWorker,
      "https://edstem.org/us/courses/synthetic-course-101/discussion/",
    );

    const popup = await harness.openPopup();
    await popup.waitForSelector(".popup-shell", { timeout: 15_000 });

    // The "Download current course" button must be enabled for the matched course.
    // Use data-action selectors since the popup may render in the system locale.
    const downloadCurrentBtn = popup.locator('button[data-action="start-course-export"]');
    await expect(downloadCurrentBtn).toBeEnabled({ timeout: 10_000 });

    // The "Download all courses" button must also be enabled when signed in.
    const downloadAllBtn = popup.locator('button[data-action="start-all-export"]');
    await expect(downloadAllBtn).toBeEnabled({ timeout: 10_000 });

    // Restore normal tab query for subsequent tests.
    await patchServiceWorkerActiveTab(harness.serviceWorker, null);
    await popup.close();
  });

  test("download current course button is disabled when not on an EDstem course page", async () => {
    // Set a non-EDstem URL as the "active" tab.
    await patchServiceWorkerActiveTab(harness.serviceWorker, "https://example.com/");

    const popup = await harness.openPopup();
    await popup.waitForSelector(".popup-shell", { timeout: 15_000 });

    // Current-course button must be disabled when the active tab is not a course page.
    // When not on a course page, the button renders without data-action="start-course-export".
    const downloadCurrentBtn = popup.locator('button[data-action="start-course-export"]');
    await expect(downloadCurrentBtn).toHaveCount(0);

    // All-courses button is enabled when signed in.
    const downloadAllBtn = popup.locator('button[data-action="start-all-export"]');
    await expect(downloadAllBtn).toBeEnabled({ timeout: 10_000 });

    // Restore.
    await patchServiceWorkerActiveTab(harness.serviceWorker, null);
    await popup.close();
  });

  test("download current course triggers sync and produces a Markdown download", async () => {
    // Set the active tab to the synthetic course URL.
    await patchServiceWorkerActiveTab(
      harness.serviceWorker,
      "https://edstem.org/us/courses/synthetic-course-101/discussion/",
    );

    const popup = await harness.openPopup();
    await popup.waitForSelector(".popup-shell", { timeout: 15_000 });

    // Wait for the download-current-course button to become enabled.
    const downloadCurrentBtn = popup.locator(
      'button[data-action="start-course-export"]',
    );
    await expect(downloadCurrentBtn).toBeEnabled({ timeout: 10_000 });

    // Click to start the current-course export. The extension uses
    // chrome.downloads.download() which triggers a background download; it is
    // not observable via the Playwright "download" event (which only fires for
    // page-level downloads). We verify the outcome via the popup result panel.
    await downloadCurrentBtn.click();

    // The popup result must show a compact completed/attempted ratio for the course.
    // Wait for the popup to re-render with results after the export completes.
    await popup.waitForFunction(
      () => {
        const panel = document.querySelector(".progress-panel");
        // Match "N/N" ratio — appears as "N/N Markdown files downloaded." or
        // as a course result row showing "N/N".
        return panel?.textContent?.match(/\d+\/\d+/);
      },
      undefined,
      { timeout: 30_000 },
    );
    const progressPanel = popup.locator(".progress-panel");
    const progressText = await progressPanel.textContent();

    // Result must reference a count like "1/1" or "2/2" (ratio of downloaded to attempted).
    expect(progressText).toMatch(/\d+\/\d+/);

    // The popup must never show post bodies in diagnostics.
    expect(progressText).not.toContain("Welcome to this synthetic course");
    expect(progressText).not.toContain("placeholder content");

    // The download result panel must show no raw error messages.
    // Success status means no diagnostic details section is shown.
    const diagnostics = popup.locator(".diagnostic-details");
    await expect(diagnostics).toHaveCount(0);

    await patchServiceWorkerActiveTab(harness.serviceWorker, null);
    await popup.close();
  });

  test("popup download hint explains current-course state for different tab scenarios", async () => {
    // Non-EDstem tab: hint should explain tab state without showing private data.
    await patchServiceWorkerActiveTab(harness.serviceWorker, "https://example.com/");

    const popup = await harness.openPopup();
    await popup.waitForSelector(".popup-shell", { timeout: 15_000 });

    const buttonNote = popup.locator(".button-note");
    const noteText = await buttonNote.textContent();
    // Should have some hint text about tab state.
    expect(noteText).toBeTruthy();
    expect(noteText!.length).toBeGreaterThan(0);
    // Must not include any private data markers.
    expect(noteText).not.toContain("SYNTH101");
    expect(noteText).not.toContain("SYNTH102");

    await patchServiceWorkerActiveTab(harness.serviceWorker, null);
    await popup.close();
  });
});
