import { describe, expect, it } from "vitest";

import { openSyncDb } from "../src/sync/db";
import { DiscussionProvider, SyncEngine } from "../src/sync/engine";
import { ArchivedCourse } from "../src/sync/types";

const course: ArchivedCourse = {
  id: "course-101",
  name: "Example Algorithms",
  url: "https://edstem.org/us/courses/101/discussion/",
};

function provider(threadIds: string[]): DiscussionProvider {
  return {
    async listUpdatedThreads() {
      return {
        ok: true,
        data: {
          totalThreads: threadIds.length,
          watermark: "2026-05-24T00:00:00.000Z",
          watermarkEvidence: "updated_at",
          threads: threadIds.map((threadId) => ({
            threadId,
            title: `Synthetic ${threadId}`,
            updatedAt: "2026-05-24T00:00:00.000Z",
          })),
        },
      };
    },
    async fetchThread(requestCourse, threadId) {
      return {
        ok: true,
        data: {
          thread: {
            courseId: requestCourse.id,
            threadId,
            title: `Synthetic ${threadId}`,
            updatedAt: "2026-05-24T00:00:00.000Z",
          },
          posts: [
            {
              courseId: requestCourse.id,
              threadId,
              postId: `${threadId}-post`,
              body: `Synthetic body ${threadId}`,
              createdAt: "2026-05-24T00:00:00.000Z",
            },
          ],
        },
      };
    },
  };
}

describe("sync engine", () => {
  it("syncs an explicit course into persisted archive data", async () => {
    const repo = await openSyncDb({ namespace: "engine-single" });
    const engine = new SyncEngine({
      repository: repo,
      provider: provider(["thread-1", "thread-2"]),
      makeRunId: () => "run-single",
    });

    const result = await engine.start({ mode: "course", courses: [course] });

    expect(result.outcome).toBe("success");
    await expect(repo.listThreads(course.id)).resolves.toHaveLength(2);
    await expect(repo.getCourseCheckpoint(course.id)).resolves.toEqual(
      expect.objectContaining({
        lastThreadId: "thread-2",
        completedThreadIds: ["thread-1", "thread-2"],
      }),
    );
  });

  it("runs all courses one course at a time", async () => {
    const repo = await openSyncDb({ namespace: "engine-all" });
    const observedCourses: string[] = [];
    const testProvider: DiscussionProvider = {
      async listUpdatedThreads(requestCourse) {
        observedCourses.push(`list:${requestCourse.id}`);
        return { ok: true, data: { threads: [{ threadId: `${requestCourse.id}-thread`, title: "Synthetic" }] } };
      },
      async fetchThread(requestCourse, threadId) {
        observedCourses.push(`detail:${requestCourse.id}`);
        return {
          ok: true,
          data: {
            thread: { courseId: requestCourse.id, threadId, title: "Synthetic" },
            posts: [{ courseId: requestCourse.id, threadId, postId: "post", body: "Synthetic body" }],
          },
        };
      },
    };
    const engine = new SyncEngine({
      repository: repo,
      provider: testProvider,
      makeRunId: () => "run-all",
    });

    await engine.start({
      mode: "all_courses",
      courses: [course, { ...course, id: "course-202", name: "Example Biology" }],
    });

    expect(observedCourses).toEqual([
      "list:course-101",
      "detail:course-101",
      "list:course-202",
      "detail:course-202",
    ]);
  });

  it("simulates MV3 restart by resuming from persisted checkpoint without duplicates", async () => {
    const repo = await openSyncDb({ namespace: "engine-restart" });
    await repo.persistThreadWithCheckpoint({
      course,
      thread: { courseId: course.id, threadId: "thread-1", title: "Synthetic thread-1" },
      posts: [{ courseId: course.id, threadId: "thread-1", postId: "post-1", body: "Synthetic body" }],
      checkpoint: {
        courseId: course.id,
        runId: "run-restart",
        lastThreadId: "thread-1",
        completedThreadIds: ["thread-1"],
        retryAttempt: 0,
        updatedAt: "2026-05-24T00:00:00.000Z",
      },
    });
    await repo.upsertSyncRun({
      runId: "run-restart",
      mode: "course",
      status: "running",
      courseIds: [course.id],
      currentCourseId: course.id,
      startedAt: "2026-05-24T00:00:00.000Z",
      updatedAt: "2026-05-24T00:00:00.000Z",
      retryAttempt: 0,
      courseProgress: [{ courseId: course.id, courseName: course.name, completedThreads: 1 }],
    });
    repo.close();

    const restartedRepo = await openSyncDb({ namespace: "engine-restart" });
    const restartedEngine = new SyncEngine({
      repository: restartedRepo,
      provider: provider(["thread-1", "thread-2"]),
    });

    const result = await restartedEngine.resume("run-restart");

    expect(result.outcome).toBe("success");
    await expect(restartedRepo.listThreads(course.id)).resolves.toHaveLength(2);
    await expect(restartedRepo.listPosts(course.id, "thread-1")).resolves.toHaveLength(1);
  });

  it("refetches checkpoint-completed threads that have no archived posts", async () => {
    const repo = await openSyncDb({ namespace: "engine-empty-post-refetch" });
    await repo.persistThreadWithCheckpoint({
      course,
      thread: { courseId: course.id, threadId: "thread-1", title: "Synthetic thread-1" },
      posts: [],
      checkpoint: {
        courseId: course.id,
        runId: "run-empty-refetch",
        lastThreadId: "thread-1",
        completedThreadIds: ["thread-1"],
        retryAttempt: 0,
        updatedAt: "2026-05-24T00:00:00.000Z",
      },
    });

    let fetched = 0;
    const engine = new SyncEngine({
      repository: repo,
      provider: {
        async listUpdatedThreads() {
          return { ok: true, data: { threads: [{ threadId: "thread-1", title: "Synthetic thread-1" }] } };
        },
        async fetchThread(requestCourse, threadId) {
          fetched += 1;
          return {
            ok: true,
            data: {
              thread: { courseId: requestCourse.id, threadId, title: "Synthetic thread-1" },
              posts: [{ courseId: requestCourse.id, threadId, postId: "post-1", body: "Recovered body" }],
            },
          };
        },
      },
      makeRunId: () => "run-empty-refetch-2",
    });

    await engine.start({ mode: "course", courses: [course] });

    expect(fetched).toBe(1);
    await expect(repo.listPosts(course.id, "thread-1")).resolves.toHaveLength(1);
  });

  it("honors cooperative cancellation between threads", async () => {
    const repo = await openSyncDb({ namespace: "engine-cancel" });
    let fetched = 0;
    const testProvider: DiscussionProvider = {
      async listUpdatedThreads() {
        return {
          ok: true,
          data: {
            threads: [
              { threadId: "thread-1", title: "Synthetic 1" },
              { threadId: "thread-2", title: "Synthetic 2" },
            ],
          },
        };
      },
      async fetchThread(requestCourse, threadId) {
        fetched += 1;
        if (fetched === 1) {
          await repo.requestCancel("run-cancel", "2026-05-24T00:01:00.000Z");
        }
        return {
          ok: true,
          data: {
            thread: { courseId: requestCourse.id, threadId, title: "Synthetic" },
            posts: [{ courseId: requestCourse.id, threadId, postId: "post", body: "Synthetic body" }],
          },
        };
      },
    };
    const engine = new SyncEngine({
      repository: repo,
      provider: testProvider,
      makeRunId: () => "run-cancel",
    });

    const result = await engine.start({ mode: "course", courses: [course] });

    expect(result.outcome).toBe("cancelled");
    expect(fetched).toBe(1);
    await expect(repo.listThreads(course.id)).resolves.toHaveLength(1);
    await expect(repo.getSyncRun("run-cancel")).resolves.toEqual(
      expect.objectContaining({ status: "cancelled", cancelRequested: true }),
    );
  });

  it("limits thread detail concurrency to at most two", async () => {
    const repo = await openSyncDb({ namespace: "engine-concurrency" });
    let active = 0;
    let maxActive = 0;
    const testProvider: DiscussionProvider = {
      async listUpdatedThreads() {
        return {
          ok: true,
          data: {
            threads: ["thread-1", "thread-2", "thread-3"].map((threadId) => ({
              threadId,
              title: `Synthetic ${threadId}`,
            })),
          },
        };
      },
      async fetchThread(requestCourse, threadId) {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await Promise.resolve();
        active -= 1;
        return {
          ok: true,
          data: {
            thread: { courseId: requestCourse.id, threadId, title: "Synthetic" },
            posts: [{ courseId: requestCourse.id, threadId, postId: "post", body: "Synthetic body" }],
          },
        };
      },
    };
    const engine = new SyncEngine({
      repository: repo,
      provider: testProvider,
      makeRunId: () => "run-concurrency",
      maxThreadConcurrency: 2,
    });

    await engine.start({ mode: "course", courses: [course] });

    expect(maxActive).toBe(2);
  });

  it("persists retry waits for rate limits", async () => {
    const repo = await openSyncDb({ namespace: "engine-retry" });
    const engine = new SyncEngine({
      repository: repo,
      provider: {
        async listUpdatedThreads() {
          return {
            ok: false,
            kind: "rate_limited",
            status: 429,
            message: "Edstem asked the extension to retry later.",
            retryAfterSeconds: 90,
          };
        },
        async fetchThread() {
          throw new Error("not reached");
        },
      },
      makeRunId: () => "run-retry",
      clock: { now: () => new Date("2026-05-24T00:00:00.000Z") },
    });

    await engine.start({ mode: "course", courses: [course] });

    await expect(repo.getSyncRun("run-retry")).resolves.toEqual(
      expect.objectContaining({
        status: "waiting_retry",
        retryAttempt: 1,
        nextAttemptAt: "2026-05-24T00:01:30.000Z",
      }),
    );
  });

  it("starts a fresh run after an auth-expired run", async () => {
    const repo = await openSyncDb({ namespace: "engine-auth-expired-fresh" });
    await repo.upsertSyncRun({
      runId: "run-auth-expired",
      mode: "course",
      status: "auth_expired",
      courseIds: [course.id],
      currentCourseId: course.id,
      startedAt: "2026-05-24T00:00:00.000Z",
      updatedAt: "2026-05-24T00:01:00.000Z",
      retryAttempt: 0,
      courseProgress: [{ courseId: course.id, courseName: course.name, completedThreads: 0 }],
    });
    const engine = new SyncEngine({
      repository: repo,
      provider: provider([]),
      makeRunId: () => "run-fresh",
    });

    const result = await engine.start({ mode: "course", courses: [course] });

    expect(result.run.runId).toBe("run-fresh");
    expect(result.outcome).toBe("success");
  });
});
