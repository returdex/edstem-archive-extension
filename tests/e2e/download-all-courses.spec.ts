/**
 * Phase 17 E2E: Download all courses workflow.
 *
 * Verifies the full popup -> background worker -> multi-course sync -> export
 * -> Downloads flow for the "Download all courses" action.
 *
 * The fixture covers two synthetic courses with at least two threads each.
 * The dataset is intentionally small to keep CI fast while covering the
 * per-course progress/result rendering paths.
 *
 * All fixture data is synthetic. No real EDstem course names, course IDs,
 * student names, instructor names, cookies, auth headers, or private thread
 * bodies appear in these tests.
 *
 * Privacy contract:
 * - Discussion bodies appear only in downloaded Markdown artifacts.
 * - Popup diagnostics never include post bodies, auth headers, or tokens.
 * - Per-course result rows show only counts, not content.
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

  // Redirect all edstem.org network requests to the synthetic fixture server.
  await patchServiceWorkerFetch(harness.serviceWorker, fixtureServer);
});

test.afterAll(async () => {
  await harness?.close();
  await fixtureServer?.stop();
});

test.describe("all courses download", () => {
  test("download all courses button is available when signed in with visible courses", async () => {
    const popup = await harness.openPopup();
    await popup.waitForSelector(".popup-shell", { timeout: 15_000 });

    // The all-courses export button must be enabled when signed in.
    const downloadAllBtn = popup.locator('button[data-action="start-all-export"]');
    await expect(downloadAllBtn).toBeEnabled({ timeout: 10_000 });

    // The signed-in status must be visible.
    const statusPill = popup.locator(".status-pill");
    const pillText = await statusPill.textContent();
    expect(pillText).toBeTruthy();

    // The course list in the progress panel must show at least one course.
    const courseList = popup.locator(".course-list li");
    const courseCount = await courseList.count();
    expect(courseCount).toBeGreaterThanOrEqual(1);

    await popup.close();
  });

  test("download all courses triggers sync and export for all synthetic courses", async () => {
    const popup = await harness.openPopup();
    await popup.waitForSelector(".popup-shell", { timeout: 15_000 });

    // Ensure all-courses button is enabled.
    const downloadAllBtn = popup.locator('button[data-action="start-all-export"]');
    await expect(downloadAllBtn).toBeEnabled({ timeout: 10_000 });

    // Click download all courses.
    await downloadAllBtn.click();

    // Wait for the progress panel to show a download result with a ratio.
    // The export may show per-course results like "X/Y Markdown files downloaded."
    await popup.waitForFunction(
      () => {
        const panel = document.querySelector(".progress-panel");
        return panel?.textContent?.match(/\d+\/\d+/);
      },
      undefined,
      { timeout: 30_000 },
    );

    const progressPanel = popup.locator(".progress-panel");
    const progressText = await progressPanel.textContent();

    // Must show a ratio of downloaded/attempted files.
    expect(progressText).toMatch(/\d+\/\d+/);

    // Discussion bodies must not appear in diagnostics.
    expect(progressText).not.toContain("Synthetic lecture notes");
    expect(progressText).not.toContain("placeholder content");
    expect(progressText).not.toContain("Welcome to this synthetic course");

    await popup.close();
  });

  test("per-course results are rendered from persisted export state", async () => {
    // After the all-courses export, re-open the popup.
    // The export state should be persisted in IndexedDB and visible in the
    // progress panel without re-running the export.
    const popup = await harness.openPopup();
    await popup.waitForSelector(".popup-shell", { timeout: 15_000 });

    // Wait for the panel to show download results.
    await popup.waitForFunction(
      () => {
        const panel = document.querySelector(".progress-panel");
        return panel?.textContent?.match(/\d+\/\d+/);
      },
      undefined,
      { timeout: 15_000 },
    );

    const progressPanel = popup.locator(".progress-panel");
    const progressText = await progressPanel.textContent();

    // Should show at least one course result row.
    expect(progressText).toMatch(/\d+\/\d+/);

    // Must show at least one synthetic course name.
    const hasSyntheticCourseName =
      (progressText ?? "").includes("Synthetic") ||
      (progressText ?? "").includes("Computing") ||
      (progressText ?? "").includes("Algorithms");
    expect(hasSyntheticCourseName).toBe(true);

    // "Open downloads folder" button should be available after a successful export.
    const openFolderBtn = popup.locator('button[data-action="open-downloads-folder"]');
    await expect(openFolderBtn).toBeVisible({ timeout: 5_000 });

    // Download result must not include post bodies.
    expect(progressText).not.toContain("Synthetic lecture notes");
    expect(progressText).not.toContain("Thank you! Looking forward");

    await popup.close();
  });

  test("download result shows no errors for successful synthetic all-courses export", async () => {
    const popup = await harness.openPopup();
    await popup.waitForSelector(".popup-shell", { timeout: 15_000 });

    // Wait for results to appear.
    await popup.waitForFunction(
      () => {
        const panel = document.querySelector(".progress-panel");
        return panel?.textContent?.match(/\d+\/\d+/);
      },
      undefined,
      { timeout: 15_000 },
    );

    // No diagnostic-details element should appear for a successful export.
    const diagnostics = popup.locator(".diagnostic-details");
    await expect(diagnostics).toHaveCount(0);

    await popup.close();
  });
});
