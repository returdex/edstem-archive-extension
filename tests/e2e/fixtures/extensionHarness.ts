/**
 * MV3 extension launch helper for Playwright E2E tests.
 *
 * Launches the pre-built Chrome extension in a Playwright persistent browser
 * context using bundled Chromium. Real Chrome/Edge removed the command-line
 * flags needed for side-loading extensions, so this helper always uses the
 * Playwright-bundled Chromium binary.
 *
 * Security boundaries:
 * - Does NOT print browser profile paths or extension ids to stdout/stderr
 *   beyond what is needed for test assertions.
 * - The user data directory is isolated under tests/e2e/.output/user-data/
 *   which is git-ignored.
 * - The extension path is derived from the local build output, never from a
 *   production or real-user browser profile.
 *
 * Usage:
 *   const harness = await launchExtension();
 *   const popupPage = await harness.openPopup();
 *   // ... interact with popupPage ...
 *   await harness.close();
 */

import { chromium, BrowserContext, Page } from "@playwright/test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const EXTENSION_ROOT = join(__dirname, "..", "..", "..", ".output", "chrome-mv3");
const USER_DATA_BASE = join(__dirname, "..", ".output", "user-data");

export interface ExtensionHarness {
  context: BrowserContext;
  extensionId: string;
  /** The extension service worker handle (MV3 background). */
  serviceWorker: import("@playwright/test").Worker;
  /** Opens the extension popup as a full page (chrome-extension://.../ popup.html). */
  openPopup(): Promise<Page>;
  /** Closes the browser context cleanly. */
  close(): Promise<void>;
}

/**
 * Launches the built MV3 extension in a persistent Chromium context.
 *
 * @param userDataDir - Optional override for the user data directory.
 *   Defaults to an isolated directory under tests/e2e/.output/user-data/.
 *   The directory will be created if it does not exist.
 * @param cleanOnClose - Whether to remove the user data directory after close().
 *   Defaults to true so each test run starts fresh.
 */
export async function launchExtension(options?: {
  userDataDir?: string;
  cleanOnClose?: boolean;
}): Promise<ExtensionHarness> {
  if (!existsSync(EXTENSION_ROOT)) {
    throw new Error(
      `Built extension not found at ${EXTENSION_ROOT}. ` +
        "Run `npm run build` before running E2E tests.",
    );
  }

  const cleanOnClose = options?.cleanOnClose ?? true;
  const userDataDir =
    options?.userDataDir ?? join(USER_DATA_BASE, `run-${randomUUID()}`);

  mkdirSync(userDataDir, { recursive: true });

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_ROOT}`,
      `--load-extension=${EXTENSION_ROOT}`,
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const { extensionId, serviceWorker } = await discoverExtension(context);

  const harness: ExtensionHarness = {
    context,
    extensionId,
    serviceWorker,

    async openPopup(): Promise<Page> {
      const popupUrl = `chrome-extension://${extensionId}/popup.html`;
      const page = await context.newPage();
      await page.goto(popupUrl);
      return page;
    },

    async close(): Promise<void> {
      await context.close();
      if (cleanOnClose && existsSync(userDataDir)) {
        try {
          rmSync(userDataDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup failures — they are non-fatal for test results.
        }
      }
    },
  };

  return harness;
}

/**
 * Discovers the loaded extension's id and service worker by waiting for the
 * service worker to register or by inspecting the background pages.
 *
 * MV3 extensions use a service worker rather than a background page. Playwright
 * exposes it via context.serviceWorkers(). If the worker has not started yet we
 * wait briefly for the first one to appear.
 *
 * NOTE: This does NOT log the extension id to stdout/stderr; it is used
 * internally to construct chrome-extension:// URLs for navigation.
 */
async function discoverExtension(
  context: BrowserContext,
): Promise<{ extensionId: string; serviceWorker: import("@playwright/test").Worker }> {
  // Wait for the service worker to be registered (MV3 background).
  // In Playwright, service workers appear in context.serviceWorkers().
  const workers = context.serviceWorkers();
  if (workers.length > 0) {
    return {
      extensionId: extractExtensionId(workers[0].url()),
      serviceWorker: workers[0],
    };
  }

  // Wait for the first service worker event.
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          "Timed out waiting for extension service worker. " +
            "Make sure the extension is built and the EXTENSION_ROOT path is correct.",
        ),
      );
    }, 10_000);

    context.once("serviceworker", (worker) => {
      clearTimeout(timeout);
      resolve({
        extensionId: extractExtensionId(worker.url()),
        serviceWorker: worker,
      });
    });
  });
}

function extractExtensionId(workerUrl: string): string {
  // chrome-extension://<id>/background.js
  const match = /^chrome-extension:\/\/([a-z]{32})\//i.exec(workerUrl);
  if (!match) {
    throw new Error(
      "Could not extract extension id from service worker URL. " +
        "The extension may not have loaded correctly.",
    );
  }
  return match[1];
}
