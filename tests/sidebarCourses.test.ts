import { describe, expect, it } from "vitest";

import { extractSidebarCourses } from "../src/edstem/sidebarCourses";

class FakeLink {
  constructor(
    public textContent: string | null,
    private href: string | null,
  ) {}

  getAttribute(name: string): string | null {
    return name === "href" ? this.href : null;
  }
}

function fakeRoot(links: FakeLink[]) {
  return {
    querySelectorAll() {
      return links;
    },
  };
}

describe("extractSidebarCourses", () => {
  it("extracts normalized course rows from sidebar links", () => {
    const courses = extractSidebarCourses(
      fakeRoot([
        new FakeLink("Example Algorithms", "https://edstem.org/us/courses/101/discussion/"),
        new FakeLink("Example Biology", "/us/courses/202/discussion/"),
      ]),
    );

    expect(courses).toEqual([
      {
        id: "101",
        name: "Example Algorithms",
        url: "https://edstem.org/us/courses/101/discussion/",
        source: "sidebar",
      },
      {
        id: "202",
        name: "Example Biology",
        url: "https://edstem.org/us/courses/202/discussion/",
        source: "sidebar",
      },
    ]);
  });

  it("deduplicates course links deterministically", () => {
    const courses = extractSidebarCourses(
      fakeRoot([
        new FakeLink("Example Algorithms", "/us/courses/101/discussion/"),
        new FakeLink("Example Algorithms copy", "/us/courses/101"),
      ]),
    );

    expect(courses).toHaveLength(1);
  });

  it("ignores non-course and blank links", () => {
    const courses = extractSidebarCourses(
      fakeRoot([
        new FakeLink("Help", "/help"),
        new FakeLink("", "/us/courses/101/discussion/"),
        new FakeLink("2", "/us/courses/101/discussion/"),
        new FakeLink("Missing URL", null),
      ]),
    );

    expect(courses).toEqual([]);
  });

  it("ignores course-scoped action links", () => {
    const courses = extractSidebarCourses(
      fakeRoot([
        new FakeLink("新建主题", "/au/courses/5145/discussion/new"),
        new FakeLink("New Thread", "/au/courses/5145/discussion/new"),
      ]),
    );

    expect(courses).toEqual([]);
  });

  it("ignores individual thread links under a course", () => {
    const courses = extractSidebarCourses(
      fakeRoot([
        new FakeLink(
          "Complete Your SETU Surveys & Go in the Draw to Win a $150 Gift Card",
          "/au/courses/10101/discussion/414",
        ),
        new FakeLink("Assignment 1 grades and feedback released", "/au/courses/10101/discussion/389"),
      ]),
    );

    expect(courses).toEqual([]);
  });

  it("removes sidebar unread counters from course names", () => {
    const courses = extractSidebarCourses(
      fakeRoot([
        new FakeLink("SYNTH101/SYNTH102 2", "/au/courses/10101/discussion"),
        new FakeLink("SYNTH201 S1 2026 42", "/au/courses/44444/discussion"),
      ]),
    );

    expect(courses.map((course) => course.name)).toEqual([
      "SYNTH101/SYNTH102",
      "SYNTH201 S1 2026",
    ]);
  });

  it("uses only link href and visible text from the sidebar", () => {
    const courses = extractSidebarCourses(
      fakeRoot([
        new FakeLink("Example Studio", "/us/courses/303/discussion/"),
      ]),
    );

    expect(JSON.stringify(courses)).toBe(
      JSON.stringify([
        {
          id: "303",
          name: "Example Studio",
          url: "https://edstem.org/us/courses/303/discussion/",
          source: "sidebar",
        },
      ]),
    );
  });
});
