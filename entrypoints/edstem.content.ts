import { defineContentScript } from "wxt/utils/define-content-script";

import { FETCH_EDSTEM_API, GET_SIDEBAR_COURSES } from "../src/background/messageTypes";
import { edstemFetch } from "../src/edstem/client";
import type { EdstemResult } from "../src/edstem/errors";
import { extractSidebarCourses } from "../src/edstem/sidebarCourses";
import { extractThreadSummaryFromUrl, extractVisibleThreadSummaries } from "../src/edstem/sidebarThreads";

export default defineContentScript({
  matches: ["https://edstem.org/*", "https://*.edstem.org/*"],
  main() {
    chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (!message || typeof message !== "object") {
        return undefined;
      }

      const type = (message as { type?: unknown }).type;
      if (type === GET_SIDEBAR_COURSES) {
        sendResponse({ courses: extractSidebarCourses(document) });
        return false;
      }

      if (type !== FETCH_EDSTEM_API) {
        return undefined;
      }

      const path = (message as { path?: unknown }).path;
      if (typeof path !== "string" || !path.startsWith("/api/")) {
        sendResponse({
          ok: false,
          kind: "network_error",
          message: "Request target is outside the Edstem allowlist.",
        });
        return false;
      }

      void fetchEdstemApiFromPage(path).then(sendResponse);
      return true;
    });
  },
});

async function fetchEdstemApiFromPage<T>(path: string): Promise<EdstemResult<T>> {
  let firstFailure: EdstemResult<T> | undefined;

  for (const candidatePath of pageApiPathCandidates(path)) {
    const result = await fetchEdstemApiPath<T>(candidatePath);
    const visibleThreadsResult = withVisibleThreadFallback<T>(path, result);
    if (visibleThreadsResult.ok) {
      return visibleThreadsResult;
    }
    if (result.ok) {
      return result;
    }
    firstFailure ??= result;
    if (!shouldTryNextApiPath(result)) {
      return result;
    }
  }

  return firstFailure ?? {
    ok: false,
    kind: "network_error",
    message: "Request target is outside the Edstem allowlist.",
  };
}

async function fetchEdstemApiPath<T>(path: string): Promise<EdstemResult<T>> {
  const plainResult = await edstemFetch<T>(path, { baseOrigin: window.location.origin });
  if (plainResult.ok || !["unauthenticated", "forbidden"].includes(plainResult.kind)) {
    return plainResult;
  }

  for (const headers of authHeaderCandidates()) {
    const result = await edstemFetch<T>(path, {
      baseOrigin: window.location.origin,
      init: { headers },
    });
    if (result.ok || !["unauthenticated", "forbidden"].includes(result.kind)) {
      return result;
    }
  }

  return plainResult;
}

function pageApiPathCandidates(path: string): string[] {
  const candidates: string[] = [];
  const region = currentPathRegion();
  if (region && path.startsWith("/api/")) {
    candidates.push(`/${region}${path}`);
  }
  candidates.push(path);
  return [...new Set(candidates)];
}

function currentPathRegion(): string | undefined {
  const [, region] = /^\/([a-z]{2})(?:\/|$)/i.exec(window.location.pathname) ?? [];
  return region?.toLowerCase();
}

function shouldTryNextApiPath<T>(result: EdstemResult<T>): boolean {
  return !result.ok && ["unexpected_status", "parse_error", "network_error", "unauthenticated", "forbidden"].includes(result.kind);
}

function withVisibleThreadFallback<T>(originalPath: string, result: EdstemResult<T>): EdstemResult<T> {
  const courseId = courseIdFromThreadListPath(originalPath);
  if (!courseId) {
    return result;
  }

  if (result.ok && !isEmptyThreadListPayload(result.data)) {
    return result;
  }

  const threads = visibleThreadFallbacks(courseId);
  if (threads.length === 0) {
    return result;
  }

  return {
    ok: true,
    status: result.ok ? result.status : (result.status ?? 200),
    data: {
      threads,
      total: threads.length,
      source: "visible_discussion_links",
    } as T,
  };
}

function visibleThreadFallbacks(courseId: string): ReturnType<typeof extractVisibleThreadSummaries> {
  const threads = extractVisibleThreadSummaries(document, courseId);
  const currentThread = extractThreadSummaryFromUrl(window.location.href, courseId, document.title);
  if (currentThread && !threads.some((thread) => thread.threadId === currentThread.threadId)) {
    threads.unshift(currentThread);
  }
  return threads;
}

function courseIdFromThreadListPath(path: string): string | undefined {
  const match = /^\/api\/courses\/([^/]+)\/threads(?:\?|$)/.exec(path);
  return match ? decodeURIComponent(match[1]) : undefined;
}

function isEmptyThreadListPayload(payload: unknown): boolean {
  const root = asRecord(payload);
  const candidates = [
    asArray(root.threads),
    asArray(root.posts),
    asArray(root.data),
    asArray(asRecord(root.data).threads),
    asArray(asRecord(root.results).threads),
    asArray(root.results),
  ].filter((value): value is unknown[] => Array.isArray(value));

  return candidates.length > 0 && candidates.every((value) => value.length === 0);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function authHeaderCandidates(): Array<Record<string, string>> {
  const candidates: Array<Record<string, string>> = [];
  const seen = new Set<string>();

  for (const value of storageSecretCandidates(window.localStorage)) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    candidates.push({ "X-Token": value });
    candidates.push({ "X-Access-Token": value });
  }

  for (const value of storageSecretCandidates(window.sessionStorage)) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    candidates.push({ "X-Token": value });
    candidates.push({ "X-Access-Token": value });
  }

  return candidates;
}

function storageSecretCandidates(storage: Storage): string[] {
  const candidates: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) {
      continue;
    }
    const value = storage.getItem(key);
    if (!value) {
      continue;
    }
    collectStorageCandidate(key, value, candidates);
  }
  return candidates;
}

function collectStorageCandidate(key: string, value: string, candidates: string[]): void {
  const lowered = key.toLowerCase();
  if (isLikelyAuthKey(lowered) && isLikelySecretValue(value)) {
    candidates.push(value);
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    collectNestedStorageCandidates(parsed, candidates);
  } catch {
    // Non-JSON storage value.
  }
}

function collectNestedStorageCandidates(value: unknown, candidates: string[]): void {
  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const lowered = key.toLowerCase();
    if (typeof nestedValue === "string" && isLikelyAuthKey(lowered) && isLikelySecretValue(nestedValue)) {
      candidates.push(nestedValue);
      continue;
    }
    if (nestedValue && typeof nestedValue === "object") {
      collectNestedStorageCandidates(nestedValue, candidates);
    }
  }
}

function isLikelyAuthKey(key: string): boolean {
  return key.includes("token") || key.includes("auth") || key.includes("jwt");
}

function isLikelySecretValue(value: string): boolean {
  return value.length >= 16 && !/\s/.test(value);
}
