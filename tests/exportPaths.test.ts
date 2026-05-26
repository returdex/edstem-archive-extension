import { describe, expect, it } from "vitest";

import { buildCourseFolder, buildThreadExportPath, sanitizePathPart } from "../src/export/paths";

describe("export path helpers", () => {
  it("builds a stable course folder under the browser downloads folder", () => {
    expect(buildCourseFolder({ id: "101", name: "Example Algorithms" })).toBe(
      "EdstemArchive/Example Algorithms-101",
    );
  });

  it("sanitizes unsafe Windows path characters and reserved names", () => {
    expect(sanitizePathPart("CON", "fallback")).toBe("CON-file");
    expect(sanitizePathPart("week/1: intro?", "fallback")).toBe("week-1- intro");
  });

  it("includes thread number, title, and id in markdown filenames", () => {
    expect(
      buildThreadExportPath(
        { id: "101", name: "Example Algorithms" },
        { courseId: "101", threadId: "thread-7", number: 7, title: "Exam <tips>" },
      ),
    ).toBe("EdstemArchive/Example Algorithms-101/0007-Exam -tips-thread-7.md");
  });
});
