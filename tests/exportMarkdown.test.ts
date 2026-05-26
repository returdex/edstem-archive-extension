import { describe, expect, it } from "vitest";

import { renderThreadMarkdown } from "../src/export/markdown";

describe("thread markdown renderer", () => {
  it("renders body content in deterministic parent-child order", () => {
    const markdown = renderThreadMarkdown({
      course: { id: "101", name: "Example Algorithms" },
      thread: {
        courseId: "101",
        threadId: "thread-1",
        number: 4,
        title: "# Week 1 setup",
        category: "General",
      },
      posts: [
        {
          courseId: "101",
          threadId: "thread-1",
          postId: "reply",
          parentPostId: "root",
          body: "<p>Reply &amp; details</p>",
          authorName: "Teacher",
          authorRole: "staff",
          createdAt: "2026-05-24T00:02:00.000Z",
        },
        {
          courseId: "101",
          threadId: "thread-1",
          postId: "root",
          body: "<p>Question body</p><script>ignored()</script>",
          authorName: "Student",
          createdAt: "2026-05-24T00:01:00.000Z",
        },
      ],
    });

    expect(markdown).toContain("# Week 1 setup");
    expect(markdown.indexOf("Question body")).toBeLessThan(markdown.indexOf("Reply & details"));
    expect(markdown).not.toContain("ignored()");
    expect(markdown).toContain("### Post by Teacher (staff)");
  });

  it("uses an explicit placeholder for empty archived bodies", () => {
    const markdown = renderThreadMarkdown({
      course: { id: "101", name: "Example Algorithms" },
      thread: { courseId: "101", threadId: "thread-1", title: "Empty" },
      posts: [{ courseId: "101", threadId: "thread-1", postId: "p1", body: "" }],
    });

    expect(markdown).toContain("_No post body was archived._");
  });
});
