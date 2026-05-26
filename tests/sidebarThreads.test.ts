import { describe, expect, it } from "vitest";

import { extractThreadSummaryFromUrl, extractVisibleThreadSummaries } from "../src/edstem/sidebarThreads";

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

describe("extractVisibleThreadSummaries", () => {
  it("extracts visible thread links for the requested course", () => {
    const threads = extractVisibleThreadSummaries(
      fakeRoot([
        new FakeLink("Visible question", "/au/courses/10101/discussion/20202"),
        new FakeLink("Other course question", "/au/courses/999/discussion/1"),
      ]),
      "10101",
    );

    expect(threads).toEqual([{ threadId: "20202", title: "Visible question" }]);
  });

  it("ignores new-thread actions and deduplicates repeated visible links", () => {
    const threads = extractVisibleThreadSummaries(
      fakeRoot([
        new FakeLink("New Thread", "/au/courses/10101/discussion/new"),
        new FakeLink("Visible question", "/au/courses/10101/discussion/20202"),
        new FakeLink("Visible question copy", "/au/courses/10101/discussion/20202"),
      ]),
      "10101",
    );

    expect(threads).toEqual([{ threadId: "20202", title: "Visible question" }]);
  });

  it("extracts the current discussion thread from a course URL", () => {
    expect(
      extractThreadSummaryFromUrl(
        "https://edstem.org/au/courses/10101/discussion/20202",
        "10101",
        "Current thread title",
      ),
    ).toEqual({ threadId: "20202", title: "Current thread title" });
  });
});
