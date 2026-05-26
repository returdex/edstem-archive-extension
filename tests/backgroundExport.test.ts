import { describe, expect, it } from "vitest";

import {
  GET_EXPORT_SNAPSHOT,
  OPEN_DOWNLOADS_FOLDER,
  START_ALL_COURSES_EXPORT,
  START_COURSE_EXPORT,
} from "../src/background/messageTypes";
import { createExportController, isExportBackgroundRequest } from "../src/background/export";
import { openSyncDb } from "../src/sync/db";

async function seededRepository(namespace: string) {
  const repo = await openSyncDb({ namespace });
  await repo.persistThreadWithCheckpoint({
    course: { id: "101", name: "Example Algorithms" },
    thread: {
      courseId: "101",
      threadId: "thread-1",
      number: 1,
      title: "Welcome",
    },
    posts: [{ courseId: "101", threadId: "thread-1", postId: "post-1", body: "Hello" }],
    checkpoint: {
      courseId: "101",
      completedThreadIds: ["thread-1"],
      retryAttempt: 0,
      updatedAt: "2026-05-24T00:00:00.000Z",
    },
  });
  return repo;
}

describe("background export controller", () => {
  it("validates export runtime messages", () => {
    expect(isExportBackgroundRequest({ type: GET_EXPORT_SNAPSHOT })).toBe(true);
    expect(isExportBackgroundRequest({ type: START_ALL_COURSES_EXPORT })).toBe(true);
    expect(isExportBackgroundRequest({ type: START_COURSE_EXPORT, courseId: "101" })).toBe(true);
    expect(isExportBackgroundRequest({ type: OPEN_DOWNLOADS_FOLDER })).toBe(true);
    expect(isExportBackgroundRequest({ type: START_COURSE_EXPORT, courseId: "" })).toBe(false);
  });

  it("syncs a visible course before downloading body-free export results", async () => {
    const downloads: Array<{ filename: string; markdown: string }> = [];
    const notifications: string[] = [];
    const repo = await seededRepository("background-export-course");
    const controller = createExportController({
      makeRepository: async () => repo,
      loadSession: async () => ({
        state: "signed_in",
        courses: [
          {
            id: "101",
            name: "Example Algorithms",
            url: "https://edstem.org/us/courses/101/discussion/",
            source: "api",
          },
        ],
      }),
      syncController: {
        async startCourse(courseId) {
          return {
            ok: true,
            run: {
              runId: "run-1",
              mode: "course",
              status: "success",
              courseIds: [courseId],
              startedAt: "2026-05-24T00:00:00.000Z",
              updatedAt: "2026-05-24T00:00:00.000Z",
              retryAttempt: 0,
              courseProgress: [],
            },
          };
        },
        async startAllCourses() {
          throw new Error("not reached");
        },
      },
      downloadFiles: async (files) => {
        downloads.push(...files.map((file) => ({ filename: file.filename, markdown: file.markdown })));
        return {
          attempted: files.length,
          succeeded: files.length,
          failed: 0,
          files: files.map((file, index) => ({
            courseId: file.courseId,
            threadId: file.threadId,
            filename: file.filename,
            downloadId: index + 1,
          })),
        };
      },
      notify: async (run) => {
        notifications.push(run.status);
        return "notice-1";
      },
      now: () => "2026-05-24T00:00:00.000Z",
    });

    const result = await controller.startCourseExport("101");

    expect(result.ok).toBe(true);
    expect(result.run).toEqual(
      expect.objectContaining({
        mode: "course",
        status: "success",
        attempted: 1,
        succeeded: 1,
        courseResults: [
          expect.objectContaining({
            courseId: "101",
            courseName: "Example Algorithms",
            attempted: 1,
            succeeded: 1,
            failed: 0,
          }),
        ],
      }),
    );
    expect(result.downloads?.files[0]).not.toHaveProperty("markdown");
    expect(downloads[0].markdown).toContain("Hello");
    expect(notifications).toEqual(["success"]);

    const snapshot = await controller.getSnapshot();

    expect(snapshot.snapshot?.recentRuns[0]).toEqual(expect.objectContaining({ status: "success", attempted: 1 }));
  });

  it("persists body-free export summaries across controller instances", async () => {
    const namespace = "background-export-persisted";
    const controller = createExportController({
      makeRepository: () => openSyncDb({ namespace }),
      loadSession: async () => ({
        state: "signed_in",
        courses: [
          {
            id: "101",
            name: "Example Algorithms",
            url: "https://edstem.org/us/courses/101/discussion/",
            source: "api",
          },
        ],
      }),
      syncController: {
        async startCourse(courseId) {
          return {
            ok: true,
            run: {
              runId: "run-1",
              mode: "course",
              status: "success",
              courseIds: [courseId],
              startedAt: "2026-05-24T00:00:00.000Z",
              updatedAt: "2026-05-24T00:00:00.000Z",
              retryAttempt: 0,
              courseProgress: [],
            },
          };
        },
        async startAllCourses() {
          throw new Error("not reached");
        },
      },
      downloadFiles: async (files) => ({
        attempted: files.length,
        succeeded: files.length,
        failed: 0,
        files: files.map((file, index) => ({
          courseId: file.courseId,
          threadId: file.threadId,
          filename: file.filename,
          downloadId: index + 1,
        })),
      }),
      notify: async () => "notice-1",
      now: () => "2026-05-24T00:00:00.000Z",
    });

    const seed = await seededRepository(namespace);
    seed.close();
    await controller.startCourseExport("101");

    const reopened = createExportController({ makeRepository: () => openSyncDb({ namespace }) });
    const snapshot = await reopened.getSnapshot();
    const snapshotText = JSON.stringify(snapshot.snapshot);

    expect(snapshot.snapshot?.recentRuns[0]).toEqual(
      expect.objectContaining({
        mode: "course",
        succeeded: 1,
        courseResults: [expect.objectContaining({ courseName: "Example Algorithms" })],
      }),
    );
    expect(snapshotText).not.toContain("Hello");
    expect(snapshotText).not.toContain("Synthetic private body");
    expect(snapshotText).not.toContain("token=abc123");
  });

  it("does not export when sync pauses for retry", async () => {
    const controller = createExportController({
      loadSession: async () => ({
        state: "signed_in",
        courses: [{ id: "101", name: "Example Algorithms", url: "https://edstem.org/us/courses/101/discussion/", source: "api" }],
      }),
      syncController: {
        async startCourse() {
          return {
            ok: true,
            run: {
              runId: "run-1",
              mode: "course",
              status: "waiting_retry",
              courseIds: ["101"],
              startedAt: "2026-05-24T00:00:00.000Z",
              updatedAt: "2026-05-24T00:00:00.000Z",
              retryAttempt: 1,
              courseProgress: [],
            },
          };
        },
        async startAllCourses() {
          throw new Error("not reached");
        },
      },
      downloadFiles: async () => {
        throw new Error("not reached");
      },
      notify: async () => {
        throw new Error("not reached");
      },
    });

    await expect(controller.startCourseExport("101")).resolves.toEqual({
      ok: false,
      message: "Sync did not finish.",
    });
  });
});
