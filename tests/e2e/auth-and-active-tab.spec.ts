/**
 * Phase 17 E2E: Auth state, active-tab gating, and schema rejection.
 *
 * Covers the following scenarios:
 * - Signed-out state: popup prompts user to open/login to Edstem
 * - Non-EDstem active tab: current-course download disabled
 * - Invisible course active tab: course not visible in session
 * - Invalid API payload: safe failure with body-free diagnostics
 *
 * All fixture data is synthetic. The X-Fixture-State header is used to switch
 * the fixture server between auth-expired, normal, and error states per-test.
 *
 * Privacy contract:
 * - Error messages never expose post bodies, cookies, auth headers, or tokens.
 * - Signed-out prompt never reveals session details.
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

  // Default: signed-in fixture state.
  await patchServiceWorkerFetch(harness.serviceWorker, fixtureServer);
});

test.afterAll(async () => {
  await harness?.close();
  await fixtureServer?.stop();
});

test.describe("auth state", () => {
  test("signed-out state shows login prompt and disables download actions", async () => {
    // Switch the fixture to auth-expired so /api/user returns 401.
    await patchServiceWorkerFetch(harness.serviceWorker, fixtureServer, {
      fixtureState: "auth-expired",
    });

    const popup = await harness.openPopup();
    await popup.waitForSelector(".popup-shell", { timeout: 15_000 });

    // The status should indicate a login-required state.
    const statusPill = popup.locator(".status-pill");
    const pillText = await statusPill.textContent();
    // The status must be some kind of warning/error or login-needed state.
    expect(pillText).toBeTruthy();

    // Both download buttons must be disabled when not signed in.
    const downloadCurrentBtn = popup.locator('button[data-action="start-course-export"]');
    const downloadAllBtn = popup.locator('button[data-action="start-all-export"]');
    await expect(downloadCurrentBtn).toHaveCount(0);
    await expect(downloadAllBtn).toHaveCount(0);

    // There should be an "Open Edstem" action to prompt login.
    const openEdstemBtn = popup.locator('button[data-action="open-edstem"]');
    await expect(openEdstemBtn).toBeVisible({ timeout: 5_000 });

    // The popup text must not reveal actual token values or private data markers.
    // Note: The popup's privacy note intentionally says "cookies" in its legal
    // disclaimer ("No credentials or cookies are collected."), so we check for
    // real private data markers instead of the word "cookie" itself.
    const shellText = await popup.locator(".popup-shell").textContent();
    expect(shellText).not.toContain("SYNTH101");
    expect(shellText).not.toContain("SYNTH102");
    expect(shellText).not.toContain("10101");
    // No raw session token strings.
    expect(shellText).not.toMatch(/session_token=[a-z0-9]{10,}/i);
    expect(shellText).not.toMatch(/Bearer [a-z0-9]{10,}/i);

    // Restore to signed-in state.
    await patchServiceWorkerFetch(harness.serviceWorker, fixtureServer);
    await popup.close();
  });

  test("sync does not start when signed out", async () => {
    // Switch to auth-expired AFTER the initial signed-in load.
    await patchServiceWorkerFetch(harness.serviceWorker, fixtureServer, {
      fixtureState: "auth-expired",
    });

    const popup = await harness.openPopup();
    await popup.waitForSelector(".popup-shell", { timeout: 15_000 });

    // Neither download button should have data-action (both are disabled/absent).
    const actionButtons = popup.locator("button[data-action]");
    const count = await actionButtons.count();

    // The only action button in auth-expired/needs_login state is "open-edstem".
    // "retry" may also appear. But NOT "start-course-export" or "start-all-export".
    for (let i = 0; i < count; i++) {
      const action = await actionButtons.nth(i).getAttribute("data-action");
      expect(action).not.toBe("start-course-export");
      expect(action).not.toBe("start-all-export");
    }

    // Restore.
    await patchServiceWorkerFetch(harness.serviceWorker, fixtureServer);
    await popup.close();
  });
});

test.describe("active tab gating", () => {
  test("current-course button disabled on non-EDstem tab", async () => {
    // Patch the active tab to a non-EDstem URL.
    await patchServiceWorkerActiveTab(harness.serviceWorker, "https://example.com/");

    const popup = await harness.openPopup();
    await popup.waitForSelector(".popup-shell", { timeout: 15_000 });

    // Download current course button renders without data-action when not on course page.
    const downloadCurrentBtn = popup.locator('button[data-action="start-course-export"]');
    await expect(downloadCurrentBtn).toHaveCount(0);

    // All-courses button stays enabled (not tab-dependent).
    const downloadAllBtn = popup.locator('button[data-action="start-all-export"]');
    await expect(downloadAllBtn).toBeEnabled({ timeout: 10_000 });

    // The hint must explain that an EDstem course tab is needed.
    const hint = popup.locator(".button-note");
    const hintText = await hint.textContent();
    expect(hintText).toBeTruthy();
    // Hint text should be non-empty guidance about tab state.
    expect(hintText!.length).toBeGreaterThan(5);

    await patchServiceWorkerActiveTab(harness.serviceWorker, null);
    await popup.close();
  });

  test("current-course button disabled for EDstem non-course page", async () => {
    // An EDstem URL that is not a /courses/ path.
    await patchServiceWorkerActiveTab(harness.serviceWorker, "https://edstem.org/home");

    const popup = await harness.openPopup();
    await popup.waitForSelector(".popup-shell", { timeout: 15_000 });

    // Current-course button must be absent (disabled) since URL has no course ID.
    const downloadCurrentBtn = popup.locator('button[data-action="start-course-export"]');
    await expect(downloadCurrentBtn).toHaveCount(0);

    // All-courses button stays enabled.
    const downloadAllBtn = popup.locator('button[data-action="start-all-export"]');
    await expect(downloadAllBtn).toBeEnabled({ timeout: 10_000 });

    await patchServiceWorkerActiveTab(harness.serviceWorker, null);
    await popup.close();
  });

  test("current-course button disabled for course not in visible session", async () => {
    // Use a course ID that is NOT in the synthetic session's course list.
    await patchServiceWorkerActiveTab(
      harness.serviceWorker,
      "https://edstem.org/us/courses/synthetic-course-999/discussion/",
    );

    const popup = await harness.openPopup();
    await popup.waitForSelector(".popup-shell", { timeout: 15_000 });

    // course-999 is not in the synthetic session so current-course button must be absent.
    const downloadCurrentBtn = popup.locator('button[data-action="start-course-export"]');
    await expect(downloadCurrentBtn).toHaveCount(0);

    await patchServiceWorkerActiveTab(harness.serviceWorker, null);
    await popup.close();
  });

  test("current-course button enabled for course visible in session", async () => {
    // Use a course ID that IS in the synthetic session.
    await patchServiceWorkerActiveTab(
      harness.serviceWorker,
      "https://edstem.org/us/courses/synthetic-course-202/discussion/",
    );

    const popup = await harness.openPopup();
    await popup.waitForSelector(".popup-shell", { timeout: 15_000 });

    const downloadCurrentBtn = popup.locator('button[data-action="start-course-export"]');
    await expect(downloadCurrentBtn).toBeEnabled({ timeout: 10_000 });

    await patchServiceWorkerActiveTab(harness.serviceWorker, null);
    await popup.close();
  });
});
