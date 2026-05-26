import { describe, expect, it } from "vitest";

import { normalizeCourses } from "../src/edstem/courses";

describe("normalizeCourses", () => {
  it("normalizes top-level courses envelope", () => {
    expect(
      normalizeCourses({
        courses: [{ id: 101, name: "Example Algorithms" }],
      }),
    ).toEqual([
      {
        id: "101",
        name: "Example Algorithms",
        url: "https://edstem.org/us/courses/101/discussion/",
        source: "api",
      },
    ]);
  });

  it.each([
    { data: [{ course_id: "bio-1", title: "Example Biology" }] },
    { results: [{ courseId: "hist-1", course_name: "Example History" }] },
    { data: { courses: [{ id: "math-1", courseName: "Example Mathematics" }] } },
  ])("normalizes common envelope shape %#", (payload) => {
    expect(normalizeCourses(payload)).toHaveLength(1);
  });

  it("normalizes wrapper records with course objects", () => {
    const courses = normalizeCourses({
      courses: [
        {
          course: { id: "wrap-1", name: "Example Design", url: "/us/courses/wrap-1/discussion/" },
          role: { role: "student" },
        },
      ],
    });

    expect(courses).toEqual([
      {
        id: "wrap-1",
        name: "Example Design",
        url: "https://edstem.org/us/courses/wrap-1/discussion/",
        source: "api",
      },
    ]);
  });

  it("drops invalid records without exposing raw payloads", () => {
    expect(
      normalizeCourses({
        courses: [{ id: "missing-name" }, { name: "Missing ID" }, null],
      }),
    ).toEqual([]);
  });

  it("uses payload names instead of deriving names from URL slugs", () => {
    const courses = normalizeCourses({
      courses: [
        {
          id: "slug-1",
          name: "Exact Visible Course Name",
          url: "https://edstem.org/us/courses/slug-1/discussion/example-course-slug",
        },
      ],
    });

    expect(courses[0]?.name).toBe("Exact Visible Course Name");
  });

  it("represents an empty valid course list distinctly", () => {
    expect(normalizeCourses({ courses: [] })).toEqual([]);
  });
});
