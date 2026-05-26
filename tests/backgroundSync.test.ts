import { describe, expect, it } from "vitest";

import {
  CANCEL_SYNC,
  GET_SYNC_SNAPSHOT,
  START_ALL_COURSES_SYNC,
  START_COURSE_SYNC,
} from "../src/background/messageTypes";
import {
  createActiveTabEdstemFetcher,
  createSyncController,
  isSyncBackgroundRequest,
  SYNC_ALARM_NAME,
} from "../src/background/sync";
import { SyncEngine } from "../src/sync/engine";
import { openSyncDb } from "../src/sync/db";

function makeEngine(status: "success" | "waiting_retry" = "success") {
  return new SyncEngine({
    repository: undefined as never,
    provider: undefined as never,
  });
}

describe("background sync controller", () => {
  it("validates sync runtime messages", () => {
    expect(isSyncBackgroundRequest({ type: GET_SYNC_SNAPSHOT })).toBe(true);
    expect(isSyncBackgroundRequest({ type: START_ALL_COURSES_SYNC })).toBe(true);
    expect(isSyncBackgroundRequest({ type: START_COURSE_SYNC, courseId: "course-101" })).toBe(true);
    expect(isSyncBackgroundRequest({ type: CANCEL_SYNC, runId: "run-1" })).toBe(true);
    expect(isSyncBackgroundRequest({ type: START_COURSE_SYNC, courseId: "" })).toBe(false);
  });

  it("starts all visible courses through the engine", async () => {
    const repo = await openSyncDb({ namespace: "background-all" });
    const engine = new SyncEngine({
      repository: repo,
      provider: {
        async listUpdatedThreads() {
          return { ok: true, data: { threads: [] } };
        },
        async fetchThread() {
          throw new Error("not reached");
        },
      },
      makeRunId: () => "run-background-all",
    });
    const controller = createSyncController({
      makeEngine: async () => engine,
      loadSession: async () => ({
        state: "signed_in",
        courses: [
          {
            id: "course-101",
            name: "Example Algorithms",
            url: "https://edstem.org/us/courses/101/discussion/",
            source: "api",
          },
        ],
      }),
    });

    const result = await controller.startAllCourses();

    expect(result.ok).toBe(true);
    expect(result.run).toEqual(expect.objectContaining({ runId: "run-background-all" }));
    expect(result.snapshot?.recentRuns[0].courseProgress[0].courseName).toBe("Example Algorithms");
  });

  it("rejects start when the user is not signed in", async () => {
    const controller = createSyncController({
      makeEngine: async () => makeEngine(),
      loadSession: async () => ({ state: "needs_login" }),
    });

    await expect(controller.startAllCourses()).resolves.toEqual({
      ok: false,
      message: "Log in to Edstem before starting sync.",
    });
  });

  it("schedules a one-shot alarm for persisted retry waits", async () => {
    const alarms: Array<{ name: string; when: number | undefined }> = [];
    const repo = await openSyncDb({ namespace: "background-retry" });
    const engine = new SyncEngine({
      repository: repo,
      provider: {
        async listUpdatedThreads() {
          return {
            ok: false,
            kind: "rate_limited",
            status: 429,
            message: "Edstem asked the extension to retry later.",
            retryAfterSeconds: 60,
          };
        },
        async fetchThread() {
          throw new Error("not reached");
        },
      },
      makeRunId: () => "run-background-retry",
      clock: { now: () => new Date("2026-05-24T00:00:00.000Z") },
    });
    const controller = createSyncController({
      makeEngine: async () => engine,
      createAlarm: (name, info) => {
        alarms.push({ name, when: info.when });
      },
      loadSession: async () => ({
        state: "signed_in",
        courses: [{ id: "course-101", name: "Example Algorithms", url: "https://edstem.org/us/courses/101/discussion/", source: "api" }],
      }),
    });

    await controller.startAllCourses();

    expect(alarms).toEqual([
      { name: SYNC_ALARM_NAME, when: Date.parse("2026-05-24T00:01:00.000Z") },
    ]);
  });

  it("routes default API fetches through the active Edstem tab", async () => {
    const sent: Array<{ tabId: number; message: unknown }> = [];
    const fetcher = createActiveTabEdstemFetcher(
      async (queryInfo) => {
        if (queryInfo.active) {
          return [{ id: 7, url: "https://edstem.org/au/courses/101/discussion/" }];
        }
        return [];
      },
      async (tabId, message) => {
        sent.push({ tabId, message });
        return { ok: true, status: 200, data: { threads: [] } };
      },
    );

    await expect(fetcher("/api/courses/101/threads")).resolves.toEqual({
      ok: true,
      status: 200,
      data: { threads: [] },
    });
    expect(sent).toEqual([
      {
        tabId: 7,
        message: {
          type: "edstemArchive.fetchEdstemApi",
          path: "/api/courses/101/threads",
        },
      },
    ]);
  });
});
