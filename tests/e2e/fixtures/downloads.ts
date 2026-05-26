/**
 * E2E download directory isolation and cleanup helpers.
 *
 * Provides an isolated download directory for each E2E test run, ensuring:
 * - Downloads are captured in a unique, git-ignored directory.
 * - No downloaded files persist after the test run (cleanup on close).
 * - The download path never resolves to the user's real Downloads folder or
 *   other personal directories.
 *
 * The output directory is tests/e2e/.output/downloads/ which is covered by
 * the .gitignore pattern for E2E outputs.
 */

import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DOWNLOADS_BASE = join(__dirname, "..", ".output", "downloads");

export interface IsolatedDownloadDir {
  /** Absolute path to the isolated download directory for this test session. */
  path: string;
  /**
   * Lists all files currently in the isolated directory (non-recursive).
   * Returns filenames (not full paths).
   */
  listFiles(): string[];
  /**
   * Waits for at least one file matching `pattern` to appear in the directory,
   * polling every `intervalMs` milliseconds until `timeoutMs` elapses.
   * Returns the matched filenames.
   */
  waitForFile(pattern: RegExp, options?: { timeoutMs?: number; intervalMs?: number }): Promise<string[]>;
  /** Removes the isolated directory and all its contents. */
  cleanup(): void;
}

/**
 * Creates an isolated download directory for a single E2E test run.
 *
 * The directory path is unique per call (uses a UUID) and is automatically
 * created. Call `cleanup()` after the test to remove all contents.
 *
 * Example usage in a Playwright test:
 *
 *   const downloadDir = createIsolatedDownloadDir();
 *   // Pass downloadDir.path to launchPersistentContext as downloadsPath
 *   // or use context.route() to redirect downloads.
 *   // After test:
 *   downloadDir.cleanup();
 */
export function createIsolatedDownloadDir(): IsolatedDownloadDir {
  const path = join(DOWNLOADS_BASE, `run-${randomUUID()}`);
  mkdirSync(path, { recursive: true });

  return {
    path,

    listFiles(): string[] {
      if (!existsSync(path)) {
        return [];
      }
      return readdirSync(path).filter((entry) => {
        const fullPath = join(path, entry);
        return statSync(fullPath).isFile();
      });
    },

    async waitForFile(
      pattern: RegExp,
      options?: { timeoutMs?: number; intervalMs?: number },
    ): Promise<string[]> {
      const timeoutMs = options?.timeoutMs ?? 10_000;
      const intervalMs = options?.intervalMs ?? 250;
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        const matches = this.listFiles().filter((name) => pattern.test(name));
        if (matches.length > 0) {
          return matches;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
      }

      throw new Error(
        `Timed out waiting for a file matching ${pattern} in ${path} after ${timeoutMs}ms. ` +
          `Current contents: [${this.listFiles().join(", ")}]`,
      );
    },

    cleanup(): void {
      if (existsSync(path)) {
        try {
          rmSync(path, { recursive: true, force: true });
        } catch {
          // Non-fatal: cleanup failures should not fail tests.
        }
      }
    },
  };
}

/**
 * Ensures the E2E downloads base directory exists.
 * Idempotent — safe to call multiple times.
 */
export function ensureDownloadsBaseDir(): void {
  mkdirSync(DOWNLOADS_BASE, { recursive: true });
}

/**
 * Scans a download directory for known private-data markers.
 * Throws if any marker is found in any filename in the directory.
 *
 * This is a lightweight filename-only scan. Test bodies that read file
 * contents should perform their own content-level checks.
 *
 * Known private markers mirror those in packageInventory.test.ts and
 * package-check.ts to keep all privacy guards aligned.
 */
export function assertNoPrivateMarkersInDownloads(dirPath: string): void {
  const knownPrivateMarkers = [
    "Synthetic private marker course title",
    "SYNTH101",
    "SYNTH102",
    "10101",
  ];

  if (!existsSync(dirPath)) {
    return;
  }

  const files = readdirSync(dirPath);
  for (const file of files) {
    for (const marker of knownPrivateMarkers) {
      if (file.includes(marker)) {
        throw new Error(
          `E2E download directory contains a private-data marker in filename: ` +
            `"${marker}" found in "${file}" under ${dirPath}`,
        );
      }
    }
  }
}
