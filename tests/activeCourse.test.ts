import { describe, expect, it } from "vitest";

import { detectCurrentCourseFromActiveTab, parseEdstemCourseUrl } from "../src/background/activeCourse";

const signedInSession = {
  state: "signed_in" as const,
  courses: [
    {
      id: "101",
      name: "Example Algorithms",
      url: "https://edstem.org/us/courses/101/discussion/",
      source: "api" as const,
    },
  ],
};

describe("active course detection", () => {
  it("parses Edstem course URLs without requiring a numeric id", () => {
    expect(parseEdstemCourseUrl("https://edstem.org/us/courses/course-abc/discussion/42")).toEqual({
      courseId: "course-abc",
      url: "https://edstem.org/us/courses/course-abc/discussion/42",
    });
  });

  it("marks the active tab eligible when it belongs to a visible course", async () => {
    await expect(
      detectCurrentCourseFromActiveTab(signedInSession, async () => [
        { url: "https://edstem.org/us/courses/101/discussion/7" },
      ]),
    ).resolves.toEqual({
      state: "eligible",
      course: signedInSession.courses[0],
      tabUrl: "https://edstem.org/us/courses/101/discussion/7",
    });
  });

  it("does not guess when the tab course is not visible in the session", async () => {
    await expect(
      detectCurrentCourseFromActiveTab(signedInSession, async () => [
        { url: "https://edstem.org/us/courses/202/discussion/7" },
      ]),
    ).resolves.toEqual({
      state: "course_not_visible",
      courseId: "202",
      tabUrl: "https://edstem.org/us/courses/202/discussion/7",
    });
  });

  it("reports a login requirement before inspecting the active tab", async () => {
    await expect(
      detectCurrentCourseFromActiveTab({ state: "needs_login" }, async () => {
        throw new Error("should not query tab");
      }),
    ).resolves.toEqual({ state: "not_signed_in" });
  });
});
