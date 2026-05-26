import { describe, expect, it } from "vitest";

import { EdstemResult } from "../src/edstem/errors";
import {
  createEdstemDiscussionProvider,
  normalizeThreadDetail,
  normalizeThreadList,
} from "../src/sync/provider";

describe("sync provider normalization", () => {
  it("normalizes synthetic thread list envelopes", () => {
    expect(
      normalizeThreadList({
        data: {
          threads: [
            {
              id: "thread-1",
              title: "Synthetic question",
              updated_at: "2026-05-24T00:00:00.000Z",
            },
          ],
        },
      }),
    ).toEqual({
      threads: [
        {
          threadId: "thread-1",
          title: "Synthetic question",
          updatedAt: "2026-05-24T00:00:00.000Z",
        },
      ],
      totalThreads: 1,
      nextCursor: undefined,
      watermark: "2026-05-24T00:00:00.000Z",
      watermarkEvidence: "thread_updated_at",
    });
  });

  it("normalizes thread detail into export-ready archive records", () => {
    expect(
      normalizeThreadDetail(
        { id: "course-101", name: "Example Algorithms" },
        "thread-1",
        {
          thread: {
            id: "thread-1",
            title: "Synthetic question",
            user: { name: "Example Staff", role: "staff" },
            posts: [
              {
                id: "post-1",
                body: "Synthetic answer body",
                user: { name: "Example Student", role: "student" },
              },
            ],
          },
        },
      ),
    ).toEqual({
      thread: expect.objectContaining({
        courseId: "course-101",
        threadId: "thread-1",
        title: "Synthetic question",
        authorName: "Example Staff",
      }),
      posts: [
        expect.objectContaining({
          courseId: "course-101",
          threadId: "thread-1",
          postId: "post-1",
          body: "Synthetic answer body",
          authorName: "Example Student",
        }),
      ],
    });
  });

  it("normalizes EDstem thread documents and top-level comments", () => {
    expect(
      normalizeThreadDetail(
        { id: "course-101", name: "Example Algorithms" },
        "thread-1",
        {
          thread: {
            id: "thread-1",
            title: "Synthetic question",
            document: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Synthetic root body" }],
                },
              ],
            },
          },
          comments: [
            {
              id: "comment-1",
              document: { html: "<p>Synthetic comment body</p>" },
            },
          ],
        },
      ).posts,
    ).toEqual([
      expect.objectContaining({ postId: "thread-1", body: "Synthetic root body" }),
      expect.objectContaining({ postId: "comment-1", body: "<p>Synthetic comment body</p>" }),
    ]);
  });

  it("keeps the question, answers, replies, and nested comments", () => {
    const detail = normalizeThreadDetail(
      { id: "course-101", name: "Example Algorithms" },
      "thread-1",
      {
        thread: {
          id: "thread-1",
          title: "Synthetic question",
          question: "<p>Original question body</p>",
        },
        answers: [
          {
            id: "answer-1",
            body: "<p>Follow-up answer body</p>",
            comments: [
              {
                id: "comment-1",
                body: "<p>Nested comment body</p>",
              },
            ],
          },
        ],
        replies: [
          {
            id: "reply-1",
            content: "<p>Reply body</p>",
          },
        ],
      },
    );

    expect(detail.posts).toEqual([
      expect.objectContaining({ postId: "thread-1", body: "<p>Original question body</p>" }),
      expect.objectContaining({ postId: "reply-1", body: "<p>Reply body</p>" }),
      expect.objectContaining({ postId: "answer-1", body: "<p>Follow-up answer body</p>" }),
      expect.objectContaining({
        postId: "comment-1",
        parentPostId: "answer-1",
        body: "<p>Nested comment body</p>",
      }),
    ]);
  });

  it("uses edstemFetch through the provider seam", async () => {
    const calls: string[] = [];
    const fetcher = async <T>(path: string): Promise<EdstemResult<T>> => {
      calls.push(path);
      return {
        ok: true,
        status: 200,
        data: { threads: [{ id: "thread-1", title: "Synthetic" }] } as T,
      };
    };
    const provider = createEdstemDiscussionProvider(fetcher);

    await expect(
      provider.listUpdatedThreads({ id: "course-101", name: "Example Algorithms" }),
    ).resolves.toEqual(expect.objectContaining({ ok: true }));
    expect(calls).toEqual(["/api/courses/course-101/threads?limit=30&offset=0&sort=new"]);
  });

  it("uses the verified global thread-detail endpoint", async () => {
    const calls: string[] = [];
    const provider = createEdstemDiscussionProvider(async <T>(path: string): Promise<EdstemResult<T>> => {
      calls.push(path);
      return {
        ok: true,
        status: 200,
        data: { thread: { id: "thread-1", title: "Synthetic" }, comments: [] } as T,
      };
    });

    await expect(
      provider.fetchThread({ id: "course-101", name: "Example Algorithms" }, "thread-1"),
    ).resolves.toEqual(expect.objectContaining({ ok: true }));
    expect(calls).toEqual(["/api/threads/thread-1"]);
  });

  it("passes typed Edstem errors through without raw payloads", async () => {
    const provider = createEdstemDiscussionProvider(async () => ({
      ok: false,
      kind: "rate_limited",
      status: 429,
      message: "Edstem asked the extension to retry later.",
      retryAfterSeconds: 60,
    }));

    await expect(
      provider.listUpdatedThreads({ id: "course-101", name: "Example Algorithms" }),
    ).resolves.toEqual(expect.objectContaining({ ok: false, kind: "rate_limited" }));
  });
});
