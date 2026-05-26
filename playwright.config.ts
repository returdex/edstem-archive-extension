import { defineConfig } from "@playwright/test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

/**
 * Playwright configuration for Phase 17 E2E tests.
 *
 * E2E tests run in a separate Playwright Chromium context from the Vitest unit
 * test suite. They load the built extension from `.output/chrome-mv3/` and use
 * synthetic EDstem fixtures only — no real course data, cookies, or auth tokens
 * are committed.
 *
 * Key design decisions:
 * - Uses the Playwright-bundled Chromium (not system Chrome/Edge) because real
 *   Chrome/Edge removed the command-line flags required to side-load extensions
 *   in persistent-context mode. See: https://playwright.dev/docs/chrome-extensions
 * - Test output lives under `tests/e2e/.output/` which is covered by .gitignore
 *   patterns for test artifacts.
 * - Headless mode is unsupported for persistent contexts with extensions; the
 *   tests run with `headless: false` and `channel: undefined` (bundled Chromium).
 */
export default defineConfig({
  testDir: join(__dirname, "tests", "e2e"),
  outputDir: join(__dirname, "tests", "e2e", ".output", "results"),
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: join(__dirname, "tests", "e2e", ".output", "report"),
        open: "never",
      },
    ],
  ],
  use: {
    headless: false,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium-extension",
      use: {
        // Bundled Chromium is required; real Chrome/Edge removed side-load flags.
        channel: undefined,
        browserName: "chromium",
      },
    },
  ],
});
