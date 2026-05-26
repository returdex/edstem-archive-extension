import { describe, expect, it } from "vitest";

import { openSyncDb } from "../src/sync/db";
import { ArchivedPost, ThreadArchiveBundle } from "../src/sync/types";

function bundle(overrides: Partial<ThreadArchiveBundle> = {}): ThreadArchiveBundle {
  const posts: ArchivedPost[] = [
    {
      courseId: "course-101",
      threadId: "thread-1",
      postId: "post-1",
      body: "Synthetic private body with token=abc123",
      authorName: "Example Student",
      createdAt: "2026-05-24T00:00:00.000Z",
    },
  ];

  return {
    course: {
      id: "course-101",
      name: "Example Algorithms",
      url: "https://edstem.org/us/courses/101/discussion/",
    },
    thread: {
      courseId: "course-101",
      threadId: "thread-1",
      title: "Synthetic thread",
      updatedAt: "2026-05-24T00:00:00.000Z",
    },
    posts,
    checkpoint: {
      courseId: "course-101",
      runId: "run-1",
      lastThreadId: "thread-1",
      completedThreadIds: ["thread-1"],
      watermark: "2026-05-24T00:00:00.000Z",
      watermarkEvidence: "updated_at",
      retryAttempt: 0,
      updatedAt: "2026-05-24T00:00:00.000Z",
    },
    ...overrides,
  };
}

describe("sync IndexedDB repository", () => {
  it("persists thread data and checkpoint as a restart-readable unit", async () => {
    const repo = await openSyncDb({ namespace: "sync-storage-unit" });
    await repo.persistThreadWithCheckpoint(bundle());
    repo.close();

    const restarted = await openSyncDb({ namespace: "sync-storage-unit" });

    await expect(restarted.getCourseCheckpoint("course-101")).resolves.toEqual(
      expect.objectContaining({
        lastThreadId: "thread-1",
        completedThreadIds: ["thread-1"],
      }),
    );
    await expect(restarted.listThreads("course-101")).resolves.toHaveLength(1);
    await expect(restarted.listPosts("course-101", "thread-1")).resolves.toEqual([
      expect.objectContaining({ body: "Synthetic private body with token=abc123" }),
    ]);
  });

  it("is idempotent when the same thread is persisted again", async () => {
    const repo = await openSyncDb({ namespace: "sync-storage-idempotent" });

    await repo.persistThreadWithCheckpoint(bundle());
    await repo.persistThreadWithCheckpoint(bundle());

    await expect(repo.listThreads("course-101")).resolves.toHaveLength(1);
    await expect(repo.listPosts("course-101", "thread-1")).resolves.toHaveLength(1);
  });

  it("keeps post bodies out of sync events and snapshots", async () => {
    const repo = await openSyncDb({ namespace: "sync-storage-diagnostics" });
    await repo.persistThreadWithCheckpoint(bundle());
    await repo.upsertSyncRun({
      runId: "run-1",
      mode: "course",
      status: "running",
      courseIds: ["course-101"],
      currentCourseId: "course-101",
      startedAt: "2026-05-24T00:00:00.000Z",
      updatedAt: "2026-05-24T00:00:00.000Z",
      retryAttempt: 0,
      courseProgress: [{ courseId: "course-101", completedThreads: 1, totalThreads: 1 }],
    });
    await repo.appendSyncEvent({
      eventId: "event-1",
      runId: "run-1",
      courseId: "course-101",
      threadId: "thread-1",
      category: "thread_persisted",
      message: "Persisted https://edstem.org/api/threads/1?token=abc123",
      createdAt: "2026-05-24T00:00:00.000Z",
    });

    const eventsText = JSON.stringify(await repo.listSyncEvents("run-1"));
    const snapshotText = JSON.stringify(await repo.getSyncSnapshot());

    expect(eventsText).not.toContain("Synthetic private body");
    expect(eventsText).not.toContain("token=abc123");
    expect(snapshotText).not.toContain("Synthetic private body");
    expect(snapshotText).not.toContain("token=abc123");
  });

  it("marks cancellation as a persisted run update", async () => {
    const repo = await openSyncDb({ namespace: "sync-storage-cancel" });
    await repo.upsertSyncRun({
      runId: "run-cancel",
      mode: "all_courses",
      status: "running",
      courseIds: ["course-101"],
      startedAt: "2026-05-24T00:00:00.000Z",
      updatedAt: "2026-05-24T00:00:00.000Z",
      retryAttempt: 0,
      courseProgress: [],
    });

    const updated = await repo.requestCancel("run-cancel", "2026-05-24T00:01:00.000Z");

    expect(updated).toEqual(expect.objectContaining({ status: "cancelling", cancelRequested: true }));
    await expect(repo.getSyncRun("run-cancel")).resolves.toEqual(
      expect.objectContaining({ status: "cancelling", cancelRequested: true }),
    );
  });

  it("does not keep auth-expired runs active forever", async () => {
    const repo = await openSyncDb({ namespace: "sync-storage-auth-expired-active" });
    await repo.upsertSyncRun({
      runId: "run-auth-expired",
      mode: "course",
      status: "auth_expired",
      courseIds: ["course-101"],
      currentCourseId: "course-101",
      startedAt: "2026-05-24T00:00:00.000Z",
      updatedAt: "2026-05-24T00:01:00.000Z",
      retryAttempt: 0,
      message: "Please log in to Edstem, then resume.",
      courseProgress: [
        {
          courseId: "course-101",
          courseName: "Example Algorithms",
          completedThreads: 0,
          outcome: "auth_expired",
          message: "Please log in to Edstem, then resume.",
        },
      ],
    });

    await expect(repo.getSyncSnapshot()).resolves.toEqual({
      activeRun: undefined,
      recentRuns: [
        expect.objectContaining({
          runId: "run-auth-expired",
          status: "auth_expired",
        }),
      ],
    });
  });

  it("persists body-free export snapshots across repository instances", async () => {
    const repo = await openSyncDb({ namespace: "sync-storage-export-results" });
    await repo.putExportRun({
      runId: "export-1",
      mode: "all_courses",
      status: "partial",
      courseIds: ["course-101"],
      courseResults: [
        {
          courseId: "course-101",
          courseName: "Example Algorithms",
          status: "partial",
          attempted: 2,
          succeeded: 1,
          failed: 1,
          files: [
            {
              courseId: "course-101",
              threadId: "thread-1",
              filename: "EdstemArchive/example/synthetic.md",
              downloadId: 1,
            },
            {
              courseId: "course-101",
              threadId: "thread-2",
              filename: "EdstemArchive/example/error.md",
              error: "Failed https://edstem.org/api/threads/1?token=abc123",
            },
          ],
          message: "1/2 Markdown files downloaded.",
        },
      ],
      attempted: 2,
      succeeded: 1,
      failed: 1,
      updatedAt: "2026-05-24T00:00:00.000Z",
      message: "1/2 Markdown files downloaded.",
    });
    repo.close();

    const reopened = await openSyncDb({ namespace: "sync-storage-export-results" });
    const snapshotText = JSON.stringify(await reopened.getExportSnapshot());

    expect(snapshotText).toContain("Example Algorithms");
    expect(snapshotText).toContain("EdstemArchive/example/synthetic.md");
    expect(snapshotText).not.toContain("Synthetic private body");
    expect(snapshotText).not.toContain("token=abc123");
  });
});
