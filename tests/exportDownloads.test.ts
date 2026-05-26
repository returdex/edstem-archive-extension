import { describe, expect, it } from "vitest";

import { downloadMarkdownFiles, openDownloadsFolder } from "../src/export/downloads";

describe("downloads adapter", () => {
  it("downloads Markdown through data URLs without prompting for each file", async () => {
    const calls: unknown[] = [];
    const result = await downloadMarkdownFiles(
      [
        {
          courseId: "101",
          threadId: "thread-1",
          filename: "EdstemArchive/Course/thread-1.md",
          markdown: "# Title\n\nBody",
        },
      ],
      {
        async download(options) {
          calls.push(options);
          return 42;
        },
      },
    );

    expect(result).toEqual({
      attempted: 1,
      succeeded: 1,
      failed: 0,
      files: [
        {
          courseId: "101",
          threadId: "thread-1",
          filename: "EdstemArchive/Course/thread-1.md",
          downloadId: 42,
        },
      ],
    });
    expect(calls).toEqual([
      expect.objectContaining({
        filename: "EdstemArchive/Course/thread-1.md",
        saveAs: false,
        conflictAction: "uniquify",
      }),
    ]);
    expect(String((calls[0] as { url: string }).url)).toContain("data:text/markdown;charset=utf-8,");
  });

  it("records sanitized per-file failures without throwing", async () => {
    const result = await downloadMarkdownFiles(
      [{ courseId: "101", threadId: "thread-1", filename: "thread.md", markdown: "body" }],
      {
        async download() {
          throw new Error("Failed at https://edstem.org/us/courses/101/discussion/?token=secret");
        },
      },
    );

    expect(result.failed).toBe(1);
    expect(result.files[0].error).toBe("Failed at https://edstem.org/us/courses/101/discussion/");
  });

  it("opens the browser downloads folder when supported", async () => {
    let opened = false;
    await openDownloadsFolder({
      async download() {
        return 1;
      },
      showDefaultFolder() {
        opened = true;
      },
    });

    expect(opened).toBe(true);
  });
});
